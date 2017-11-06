import { fetchJson } from "../fetch"
import { Model } from "./model"
import { UserRepo } from "./store"
import { CacheUtil, makeCache } from "./cacheutil"
import { flatten } from "lodash"

type TransactionType = "SELL" | "BUY" | "GIVEAWAY" | "OTHER" | "RENT_OUT" | "TO_RENT" | "UNKNOWN"

export interface Listing extends Model {
	readonly id: number
	readonly title: string
	readonly description: string
	readonly phone: string
	readonly price: number
	readonly user: number
	readonly category: number
	readonly transaction_type: TransactionType
	readonly address: string
	readonly zipcode: string
	readonly city: string
	readonly country: string
	readonly images: number[]
}

async function refreshItemFn(item: Listing | number, ageInSeconds: number): Promise<Listing | null> {
	// if (ageInSeconds < 5 * 60) return null
	let id
	if (typeof item === 'string') {
		item = parseInt(item)
	}
	if (typeof item === 'number') {
		id = item
		item = {
			id: id,
			title: "",
			phone: "",
			description: "",
			price: 0,
			user: 0,
			category: 0,
			transaction_type: "UNKNOWN",
			address: "",
			zipcode: "",
			city: "",
			country: "",
			images: [],
		}
	} else {
		id = item.id
	}

	if (typeof id == "undefined") {
		console.log("item",item)
		return null
	}

	const data = await fetchJson(`https://api.guloggratis.dk/modules/gg_app/ad/view`, { id })
	// console.log(data)

	if (data.success) {
		let phone = ""
		try {
			phone = data.tlf ? data.tlf.replace(" ", "").replace(/(\+?[0-9]{2})/g, (x: string, _: string, idx: number) => {
				return (idx == 0 ? x : ` ${x}`)
			}).trim() : ""

			UserRepo.saveToCache({
				id: data.userid,
				username: data.username.trim(),
				phone: phone,
				nemid_validated: data.user_nem_id_validate,
			})

		} catch (e) {
			console.log(data)
		}

		let transaction_type: TransactionType
		switch (Object.keys(data.sales_type)[0]) {
			case "1" : {
				transaction_type = "SELL"
				break
			}
			case "2" : {
				transaction_type = "BUY"
				break
			}
			case "3" : {
				transaction_type = "SELL"
				break
			}
			case "4" : {
				transaction_type = "GIVEAWAY"
				break
			}
			case "5" : {
				transaction_type = "TO_RENT"
				break
			}
			case "6" : {
				transaction_type = "RENT_OUT"
				break
			}
			case "8" : {
				transaction_type = "OTHER"
				break
			}
			default: { // 8?
				transaction_type = "UNKNOWN"
			}
		}

		let images: number[] = flatten(data.sorted_images.map(Object.keys)).map((x:string) => parseInt(x))

		return {
			id: id,
			title: data.headline,
			phone: phone,
			description: data.descriptionForEditing,
			price: data.price_value * 100,
			user: data.userid,
			category: data.categoryid,
			transaction_type: transaction_type,
			address: data.address,
			zipcode: data.zipcode,
			city: data.city,
			country: data.country,
			images: images,
		}
	} else {
		(item as any).status = "offline"
		return item as Listing
	}
}


let cache: CacheUtil<Listing>

(async () => {
	cache = await makeCache<Listing>("listing", refreshItemFn, 5 * 24 * 60 * 60)
})()


export class ListingRepo {
	static async find(id: number): Promise<Listing | null> {
		return cache.get(id)
	}

	static async latest(category?: number, limit: number = 20): Promise<{ count: number, results: Listing[] }> {
		let memoize = cache.memoize<number[]>("latest", { limit: limit, category: category }, {
			ttl: 30,
			stale: 60 * 60,
			autoUpdate: 10,
		}, async (params) => {

			const data = await fetchJson(`https://api.guloggratis.dk/modules/gg_front/latest_items`, {
				number: params.limit,
				category_id: params.category,
			})
			return data.map((listing: { adid: number }) => listing.adid as number)

		})

		return memoize.then(async (list: number[]) => {
			const results: Listing[] = []
			for (let id of list) {
				let item = await ListingRepo.find(id)
				if (item) {
					results.push(item)
				}
			}
			return { count: limit, results: results }
		})
	}


	static async search(query: string, category: number, user: number, limit: number = 20): Promise<{ count: number, results: Listing[] }> {
		query = typeof query === "undefined" ? "" : query
		category = typeof category === "undefined" ? 0 : category
		user = typeof user === "undefined" ? 0 : user

		let memoize = cache.memoize<{ count: number, results: number[] }>("search", { query, user, category }, {
			ttl: 30,
			stale: 60 * 60,
			autoUpdate: 3,
		}, async (params) => {
			let url = `https://api.guloggratis.dk/modules/gg_app/search/result`
			let query = {
				query: params.query || '',
				category_id: params.category | 0,
				uid: params.user | 0,
			}
			const data = await fetchJson(url, query)

			return {
				count: data.nr_results,
				results: data.results.map((listing: { id: number }) => listing.id),
			}
		})

		return memoize.then(async (result: { count: number, results: number[] }) => {
			const results: Listing[] = []
			for (let id of result.results.slice(0, limit)) {
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
