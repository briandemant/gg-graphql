import { difference, uniq } from "lodash"

const { promisify } = require("util")
const fs = require("fs")
const zlib = require("zlib")
const readFileAsync = promisify(fs.readFile)
const writeFileAsync = promisify(fs.writeFile)
const unzipAsync = promisify(zlib.unzip)
const gzipAsync = promisify(zlib.gzip)

const MAX_AUTO_UPDATES = 10

import { Model } from "./model"

interface CacheRoot {
	name: string,
	saved: number,
	hasChanged: boolean,
	byId: {}
	memoize: {}
}

const useZip = process.env.ENV !== "develop"

type CachedEntry = WithTitle | WithUsername

interface WithUsername {
	item: { username: string }
}

interface WithTitle {
	item: { title: string }
}

function hasUsername(item: CachedEntry): item is WithUsername {
	return (item as WithUsername).item.username !== undefined
}

function to_human_debug(item: CachedEntry) {
	if (hasUsername(item)) {
		return item.item.username
	} else {
		return item.item.title
	}
}

async function loadFromDisk(name: string): Promise<CacheRoot> {
	try {
		let cacheRoot
		if (useZip) {
			const gzipped = await readFileAsync(`./data/${name}.json.gz`)
			const buffer = await unzipAsync(new Buffer(gzipped))

			cacheRoot = JSON.parse(buffer.toString()) as CacheRoot
			cacheRoot.hasChanged = false
		} else {

			const raw = await readFileAsync(`./data/${name}.json`)
			cacheRoot = JSON.parse(raw) as CacheRoot
			cacheRoot.hasChanged = false
		}
		console.log(`loaded ${name} cache it was ${Date.now() - cacheRoot.saved} seconds old`)

		return cacheRoot
	} catch (e) {
		return { name, saved: 0, hasChanged: false, byId: {}, memoize: {} }
	}
}

async function saveToDisk(name: string, cache: CacheRoot) {
	if (!process.env.NOW) {
		cache.saved = Date.now()
		delete cache.hasChanged
		await writeFileAsync(`./data/${name}.json`, JSON.stringify(cache, null, 2))
		const gzipped = await gzipAsync(JSON.stringify(cache))
		await writeFileAsync(`./data/${name}.json.gz`, gzipped)
		cache.hasChanged = false
		// console.log(`\n\nsaved ${name} cache\n\n`)
	}
}

function waitWithJitter(waitInSeconds: number) {
	return addJitter(waitInSeconds) * 1000
}

function addJitter(waitInSeconds: number) {
	return waitInSeconds * (0.8 + 0.3 * Math.random()) | 0
}

function errOut(err: Error | string) {
	console.error(err)
}

export type MemoizeOptions = { ttl: number, stale?: number, autoUpdate: number }

export class CacheUtil<CacheType extends Model> {
	private cache: CacheRoot
	private runningPromises = {}
	private updateQueue: number[] = []

	constructor(private name: string,
				private refreshItemFn: (item: CacheType | number, ageInSeconds: number) => Promise<Model | null>,
				private refreshItemRateInSeconds: number) {
	}

	public async init() {
		this.cache = await loadFromDisk(this.name)
		this.cache.name = this.name
		setTimeout(() => {
			this.autoRefreshItems().catch(errOut)
			this.saveCache().catch(errOut)
			this.updateOrClearMemoize().catch(errOut)
			this.processUpdateQueue().catch(errOut)
		}, 1000)
	}

	public getAgeInSeconds(id: number) {
		const item = this.cache.byId[id]
		return item ? (Date.now() - item.ts) / 1000 | 0 : Infinity
	}

	public async get(id: number, scheduleUpdate: boolean = true): Promise<CacheType | null> {
		const cached = this.cache.byId[id]
		if (typeof cached !== "undefined") {
			if (scheduleUpdate) { this.scheduleUpdate(id) }
			return cached.item
		}
		return this.refreshItemFn(id, Infinity).then((item: CacheType | null) => item ? this.update(item) : item)
	}

	public remove(id: number): void {
		delete this.cache.byId[id]
		this.cache.hasChanged = true
	}

	public all(limit: number = 0): CacheType[] {
		const all = Object.keys(this.cache.byId).map(id => this.cache.byId[id].item)
		return limit === 0 ? all : all.slice(0, limit)
	}

	public scheduleUpdate(id: number, priority: "high" | "low" = "high") {
		// add to start of queue (high pri)
		// console.log("scheduleUpdate", this.name, id, this.getAgeInSeconds(id))
		if (priority === "high") {
			var item = this.cache.byId[id]
			let ageInSeconds = this.getAgeInSeconds(id)
			console.log("updating", this.name, id, to_human_debug(item), ((ageInSeconds / 60 | 0) / 60 * 100 | 0) / 100 + "h")
			this.updateQueue.unshift(id)
		} else {
			this.updateQueue.push(id)
		}
	}

	public update(item: CacheType): CacheType {
		this.cache.hasChanged = true
		this.cache.byId[item.id] = {
			ts: Date.now(),
			item,
		}
		return item
	}

	public async memoize<T>(name: string, params: {}, options: MemoizeOptions, fn: (params: {})
		=> Promise<T>): Promise<T> {
		const key = `${name}::${JSON.stringify(params)}`

		this.cache.memoize = this.cache.memoize || {}

		let result = this.cache.memoize[key]
		if (result && Date.now() < result.ts + options.ttl * 1000) {
			// console.log("ttl ok")

			return result.value
		}

		console.log("FETCHING", name, params)
		this.runningPromises[key] = this.runningPromises[key] || fn(params).then((value) => {
			delete this.runningPromises[key]
			console.log("REFRESHING CACHE .. done")

			this.cache.memoize[key] = {
				ts: Date.now(),
				name: name,
				params: params,
				options: options,
				fn: fn,
				value: value,
			}
			return value
		})

		if (result && options.stale && Date.now() < result.ts + options.stale * 1000) {
			console.log("stale ok")
			return result.value
		} else {
			// console.log("need update")
			return this.runningPromises[key]
		}
	}

	private async saveCache() {
		if (!process.env.NOW) {
			if (this.cache.hasChanged) {
				// console.log(`saveCache ${ this.name}`)
				await saveToDisk(this.name, this.cache).catch(errOut)
			}
			setTimeout(() => this.saveCache().catch(errOut), waitWithJitter(30))
		}
	}

	private async autoRefreshItems() {
		// console.log(`autoRefreshItems ${ this.name}`)

		for (let item of this.all()) {
			// console.log(this.name, "item.id", item.id, this.getAgeInSeconds(item.id))

			if (typeof item.id === "undefined") {
				delete this.cache.byId[item.id]
			} else if (this.isItemStale(item.id)) {
				// add to end of queue (low pri)
				this.scheduleUpdate(item.id, "low")
			}
		}
		let between = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
		let sleep = waitWithJitter(between(this.refreshItemRateInSeconds / 60, 60, 60 * 60))
		// console.log("SLEEP ", sleep, this.name)

		setTimeout(() => {
			this.autoRefreshItems().catch(errOut)
		}, sleep)
	}

	private async processUpdateQueue() {
		const BATCH_TIME = 5 * 1000
		// if (this.name != "category") {
		// 	return
		// }
		// console.log("START processUpdateQueue")

		let processQueue = uniq(this.updateQueue)
		if (processQueue.length > 0) {
			// console.log("processUpdateQueue", this.name, processQueue.length)

			const started = Date.now()
			let processed: number[] = []
			for (const id of processQueue) {
				let ageInSeconds = this.getAgeInSeconds(id)

				const item = this.cache.byId[id] ? this.cache.byId[id] : id
				if (typeof item === "undefined") {
					delete this.cache.byId[id]
					continue
				}

				// console.log("updating",
				// 	this.name, id, to_human_debug(item), ((ageInSeconds / 60 | 0) / 60 * 100 | 0) / 100 + "h")

				const updated = await this.refreshItemFn(item.item, waitWithJitter(ageInSeconds) / 1000)

				if (updated) {
					const ts = Date.now()
					this.cache.byId[id] = { ts, item: updated }
					this.cache.hasChanged = true
				}
				processed.push(id)
				if (Date.now() - started > BATCH_TIME) { break }
			}
			this.updateQueue = difference(uniq(this.updateQueue), processed)

			console.log("processed", ("      " + this.name).substr(-10), processed.length, ">", this.updateQueue.length)
			// console.log("after             ", this.name, this.updateQueue.length)
		}

		setTimeout(() => this.processUpdateQueue().catch(errOut), waitWithJitter(0.1))
	}

	private isItemStale(id: number) {
		if (!this.cache.byId[id]) { return false }
		if (!this.cache.byId[id].ts) { return true }

		// add jitter to avoid all items are invalidated at the same time
		let maxAgeWithJitter = addJitter(this.refreshItemRateInSeconds)

		let age = this.getAgeInSeconds(id)

		return age > maxAgeWithJitter
	}

	private async updateOrClearMemoize() {
		// console.log(Object.keys(this.cache.memoize))
		// console.log("---")

		this.cache.memoize = this.cache.memoize || {}

		for (let key of Object.keys(this.cache.memoize)) {
			const info = this.cache.memoize[key]
			info.options.autoUpdate = Math.min(info.options.autoUpdate | 0, MAX_AUTO_UPDATES)

			const ageInSeconds = (Date.now() - info.ts) / 1000 | 0

			const stale = info.options.stale ? info.options.stale : info.options.ttl
			const wait = info.options.ttl + (stale - info.options.ttl) / (Math.pow(info.options.autoUpdate, 3) + 1)
			// console.log("wait",wait)
			// console.log("- ", key)
			// console.log(" age   ", ageInSeconds)
			// console.log(" wait  ", wait)
			// console.log(" stale ", stale)
			// console.log(" optio ", info.options)

			if (ageInSeconds > wait) {
				// console.log(key, info.options, info.fn)
				if (info.options.autoUpdate > 0 && info.fn) {
					// console.log("UPDATE ", info.options.autoUpdate)
					info.options.autoUpdate = info.options.autoUpdate - 1
					this.memoize(info.name, info.params, info.options, info.fn)
				} else if (info.options.stale && (ageInSeconds < info.options.stale)) {
					// console.log("STALE BUT KEEP")
				} else {
					// console.log("REMOVING")
					delete this.cache.memoize[key]
				}
			}
		}
		setTimeout(() => this.updateOrClearMemoize().catch(errOut), waitWithJitter(4))
	}
}

export async function makeCache<CacheType extends Model>(parameters: {
	name: string,
	refreshItemFn: (item: CacheType, ageInSeconds: number) => Promise<Model | null>,
	refreshItemRateInSeconds: number,
}): Promise<CacheUtil<CacheType>> {
	let { name, refreshItemFn, refreshItemRateInSeconds } = parameters
	const cache = new CacheUtil<CacheType>(name, refreshItemFn, refreshItemRateInSeconds)
	await cache.init()
	return cache
}