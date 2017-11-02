const { promisify } = require('util')
const fs = require('fs')
const zlib = require('zlib')
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
		// console.log(`saved ${name} cache`)
	}
}

function waitWithJitter(wait: number) {
	return wait * 1000 * (0.8 + 0.3 * Math.random()) | 0
}

export class CacheUtil<CacheType extends Model> {
	private cache: CacheRoot
	private runningPromises = {}

	constructor(private name: string,
	            private refreshItemFn: (item: CacheType | number, ageInSeconds: number) => Promise<Model | null>,
	            private refreshItemRateInSeconds: number) {
	}

	public async init() {
		this.cache = await loadFromDisk(this.name)
		this.cache.name = this.name
		setTimeout(() => {
			this.autoRefreshItems().catch((err) => console.error(err))
			this.saveCache().catch((err) => console.error(err))
			this.updateOrClearMemoize().catch((err) => console.error(err))
		}, 1000)
	}

	private async saveCache() {
		if (!process.env.NOW) {
			if (this.cache.hasChanged) {
				// console.log(`saveCache ${ this.name}`)
				await saveToDisk(this.name, this.cache).catch((err) => console.error(err))
			}
			setTimeout(() => {
				this.saveCache().catch((err) => console.error(err))
			}, waitWithJitter(2))
		}
	}


	private async autoRefreshItems() {
		// console.log(`autoRefreshItems ${ this.name}`)

		for (let item of this.all()) {

			if (this.isItemStale(item.id)) {
				let ageInSeconds = this.getAgeInSeconds(item.id)
				// console.log(this.name, item.id, (item as any).title || (item as any).username, ageInSeconds)
				const updated = await this.refreshItemFn(item, ageInSeconds)
				// console.log("updated",updated)

				if (updated && (updated != item || (item as any).hasChanged)) {
					const ts = Date.now()
					delete (item as any).hasChanged
					this.cache.byId[item.id] = { ts, item: updated }
					this.cache.hasChanged = true
				}
			}
		}
		let sleep = waitWithJitter(Math.max(this.refreshItemRateInSeconds / 100, 2))
		// console.log("SLEEP ", sleep, this.name, this.refreshItemRateInSeconds)

		setTimeout(() => {
			this.autoRefreshItems().catch((err) => console.error(err))
		}, sleep)
	}

	public getAgeInSeconds(id: number) {
		return (Date.now() - this.cache.byId[id].ts) / 1000 | 0
	}

	public async get(id: number): Promise<CacheType | null> {
		const cached = this.cache.byId[id]
		if (typeof cached !== 'undefined') {
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
		return limit == 0 ? all : all.slice(0, limit)
	}


	public update(item: CacheType): CacheType {
		this.cache.hasChanged = true
		this.cache.byId[item.id] = {
			ts: Date.now(),
			item,
		}
		return item
	}


	private isItemStale(id: number) {
		if (!this.cache.byId[id]) return false
		if (!this.cache.byId[id].ts) return true

		// add jitter to avoid all items are invalidated at the same time
		let maxAgeWithJitter = waitWithJitter(this.refreshItemRateInSeconds)

		let age = this.getAgeInSeconds(id)

		return age > maxAgeWithJitter

	}


	private async updateOrClearMemoize() {
		// console.log(Object.keys(this.cache.memoize))
		this.cache.memoize = this.cache.memoize || {}
		for (let key of Object.keys(this.cache.memoize)) {
			const info = this.cache.memoize[key]
			info.options.autoUpdate = Math.min(info.options.autoUpdate|0, MAX_AUTO_UPDATES)

			const ageInSeconds = (Date.now() - info.ts) / 1000 | 0

			const stale = info.options.stale ? info.options.stale : info.options.ttl
			const wait = info.options.ttl + (stale-info.options.ttl)/(info.options.autoUpdate + 1)
			// console.log("wait",wait)

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
		setTimeout(() => {
			this.updateOrClearMemoize().catch((err) => console.error(err))
		}, waitWithJitter(4))
	}

	public async memoize<T>(name: string, params: {}, options: { ttl: number, stale?: number, autoUpdate: number }, fn: (params: any) => Promise<T>): Promise<T> {
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
			// console.log("REFRESHING CACHE .. done")

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
			// console.log("stale ok")
			return result.value
		} else {
			// console.log("need update")
			return this.runningPromises[key]
		}
	}
}

export async function makeCache<CacheType extends Model>(name: string,
                                                         refreshItemFn: (item: CacheType, ageInSeconds: number) => Promise<Model | null>,
                                                         refreshItemRateInSeconds: number): Promise<CacheUtil<CacheType>> {
	const cache = new CacheUtil<CacheType>(name, refreshItemFn, refreshItemRateInSeconds)
	await cache.init()
	return cache
}