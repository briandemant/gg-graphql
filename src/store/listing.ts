import { fetchJson, fetchJsonP } from "../fetch"
import { Model } from "./model"
import { UserRepo } from "./store"
import { CacheUtil, makeCache } from "./cacheutil"
import { flatten, shuffle } from "lodash"

let FORCE_REFRESH_ITEMS = 24 * 60 * 60

type TransactionType = "SELL" | "BUY" | "GIVEAWAY" | "OTHER" | "RENT_OUT" | "TO_RENT" | "UNKNOWN"

export interface Listing extends Model {
	id: number
	title: string
	description: string
	phone: string
	price: number
	createdAt: number
	updatedAt: number
	expiresAt: number | null
	online: boolean
	user: number
	category: number
	transaction_type: TransactionType
	address: string
	zipcode: string
	city: string
	country: string
	images: number[]
	extra: { status: "ok" | "offline" | "error" }
}

async function refreshItemFn(item: Listing | number, ageInSeconds: number): Promise<Listing | null> {
	if (ageInSeconds < 60) {
		return null
	}

	let id
	if (typeof item === "string") {
		item = parseInt(item, 10)
	}
	if (typeof item === "number") {
		id = item
		item = {
			id: id,
			title: "",
			phone: "",
			description: "",
			price: 0,
			online: false,
			createdAt: null,
			user: 0,
			category: 0,
			transaction_type: "UNKNOWN",
			address: "",
			zipcode: "",
			city: "",
			country: "",
			images: [],
			extra: {
				status: "offline",
			},
		}
	} else {
		id = item.id
	}

	if (typeof id === "undefined") {
		console.log("item", item)
		return null
	}

	const data = await fetchJson(`https://api.guloggratis.dk/modules/gg_app/ad/view`, { id })
	// console.log(data)
// process.exit()
	if (data.success) {
		let phone = ""
		try {
			phone = data.tlf ? data.tlf.replace(" ", "").replace(/(\+?[0-9]{2})/g, (x: string, _: string,
																					idx: number) => {
				return (idx === 0 ? x : ` ${x}`)
			}).trim() : ""

			let avatar = null
			if (data.profileImage !== "" && data.profileImage) {
				avatar = data.profileImage.replace(/.*.dk\/[0-9]+\/([0-9]+)_.*/, "$1") | 0
			}


			let user = await UserRepo.find(data.userid)
			user.username = data.username.trim()
			user.phone = phone
			user.has_nemid = data.user_nem_id_validate
			user.avatar = data.avatar
			user.updatedAt = Date.now()

			UserRepo.saveToCache(user)

		} catch (e) {
			console.log(e, data)
			process.exit()
		}

		let transactionType: TransactionType
		switch (Object.keys(data.sales_type)[0]) {
			case "1" : {
				transactionType = "SELL"
				break
			}
			case "2" : {
				transactionType = "BUY"
				break
			}
			case "3" : {
				transactionType = "SELL"
				break
			}
			case "4" : {
				transactionType = "GIVEAWAY"
				break
			}
			case "5" : {
				transactionType = "TO_RENT"
				break
			}
			case "6" : {
				transactionType = "RENT_OUT"
				break
			}
			case "8" : {
				transactionType = "OTHER"
				break
			}
			default: { // 8?
				transactionType = "UNKNOWN"
			}
		}

		let images: number[] = flatten(data.sorted_images.map(Object.keys))
			.map((x: string) => parseInt(x, 10))

		return {
			id: id,
			title: data.headline + " " + data.num_online_days,
			phone: phone,
			description: data.descriptionForEditing,
			price: Math.min(2147483600, data.price_value * 100),
			online: data.online,
			// createdAt: "" + data.end,
			// createdAt: new Date(Date.now() - data.num_online_days * 24 * 60 * 60 * 1000).toISOString(),
			createdAt: data.end * 1000 - 8 * 7 * 24 * 60 * 60 * 1000,
			updatedAt: Date.now(),
			expiresAt: data.end * 1000,
			user: data.userid,
			category: data.categoryid,
			transaction_type: transactionType,
			address: data.address,
			zipcode: data.zipcode,
			city: data.city,
			country: data.country,
			images: images,
			// isBusiness: data.isBusiness,
			// isPaid: data.isPaid,
			// numOnlineDays: data.num_online_days,
			// website: data.website,
			// location: data.location ? data.location.split(",") : null,
			extra: { status: "ok" },
		}
	}
	item.extra = item.extra || { status: "offline" }
	item.extra.status = "offline"
	return item as Listing
}

let cache: CacheUtil<Listing>

(async () => {
	let params = {
		name: "listing",
		refreshItemFn: refreshItemFn,
		refreshItemRateInSeconds: FORCE_REFRESH_ITEMS,
	}
	cache = await makeCache<Listing>(params)
})()

export class ListingRepo {
	static async find(id: number): Promise<Listing | null> {
		return cache.get(id)
	}

	static async findButDontUpdate(id: number): Promise<Listing | null> {
		return cache.get(id, false)
	}

	static async front(limit: number = 20): Promise<{ count: number, results: Listing[] }> {
		let memoize = cache.memoize<number[]>("latest", { limit: limit }, {
			ttl: 30,
			stale: 2 * 60 * 60,
			autoUpdate: 10,
		}, async (params: { limit: number, category: number }) => {
			const data = await fetchJsonP(`https://mit.guloggratis.dk/modules/gg_front/front_page_items`, {
				callback: "jQuery18309420386967396377_1510152448069",
				page: 1,
				perPage: Math.max(params.limit, 100),
			})

			return data.data.map((listing: { adid: number }) => listing.adid as number)

		})

		return memoize.then(async (list: number[]) => {
			const results: Listing[] = []
			list = shuffle(list)
			list = limit > 0 ? list.slice(0, limit) : list

			for (let id of list) {
				let item = await ListingRepo.find(id)
				if (item) {
					results.push(item)
				}
			}
			return { count: limit, results: results }
		})
	}

	static async latestX(category?: number, limit: number = 20): Promise<{ count: number, results: Listing[] }> {
		let memoize = cache.memoize<number[]>("latest", { limit: limit, category: category }, {
			ttl: 30,
			stale: 2 * 60 * 60,
			autoUpdate: 10,
		}, async (params: { limit: number, category: number }) => {
			const data = await fetchJson(`https://api.guloggratis.dk/modules/gg_front/latest_items`, {
				number: Math.max(params.limit, 100),
				category_id: params.category | 0,
			})
			return data.map((listing: { adid: number }) => listing.adid as number)

		})

		return memoize.then(async (list: number[]) => {
			const results: Listing[] = []
			list = limit > 0 ? list.slice(0, limit) : list
			for (let id of list) {
				let item = await ListingRepo.find(id)
				if (item) {
					results.push(item)
				}
			}
			return { count: limit, results: results }
		})
	}

	static async latest(category: number,
						limit: number = 20): Promise<{ count: number, results: Listing[] }> {

		category = typeof category === "undefined" ? 0 : category

		let memoize = cache.memoize<{ count: number, results: number[] }>("latest", { category }, {
			ttl: 30,
			stale: 2 * 60 * 60,
			autoUpdate: 10,
		}, async (params: { category: number }) => {
			let url = `https://api.guloggratis.dk/modules/gg_app/search/result`
			let q = {
				query: "",
				category_id: params.category | 0,
				sort: "created",
				order: "desc",
			}
			const data = await fetchJson(url, q)

			return {
				count: data.nr_results,
				results: data.results.map((listing: { id: number }) => listing.id),
			}
		})

		return memoize.then(async (result: { count: number, results: number[] }) => {
			const results: Listing[] = []
			let list = limit > 0 ? result.results.slice(0, limit) : result.results
			for (let id of list) {
				let item = await  ListingRepo.find(id)
				if (item) {
					results.push(item)
				}
			}
			return {
				count: result.count,
				results: results,
			}
		})
	}

	static async search(query: string, category: number, user: number,
						limit: number = 20): Promise<{ count: number, results: Listing[] }> {
		query = typeof query === "undefined" ? "" : query
		category = typeof category === "undefined" ? 0 : category
		user = typeof user === "undefined" ? 0 : user

		let memoize = cache.memoize<{ count: number, results: number[] }>("search", { query, user, category }, {
			ttl: 30,
			stale: 2 * 60 * 60,
			autoUpdate: 10,
		}, async (params: { query: string, category: number, user: number }) => {
			let url = `https://api.guloggratis.dk/modules/gg_app/search/result`
			let q = {
				query: params.query || "",
				category_id: params.category | 0,
				uid: params.user | 0,
			}
			const data = await fetchJson(url, q)

			return {
				count: data.nr_results,
				results: data.results.map((listing: { id: number }) => listing.id),
			}
		})

		return memoize.then(async (result: { count: number, results: number[] }) => {
			const results: Listing[] = []
			let list = limit > 0 ? result.results.slice(0, limit) : result.results
			for (let id of list) {
				let item = await  ListingRepo.find(id)
				if (item) {
					results.push(item)
				}
			}
			return {
				count: result.count,
				results: results,
			}
		})
	}

	static saveToCache(listing: Listing): void {
		cache.update(listing)
	}
}
