import { fetchJson } from "../fetch"
import { Model } from "./model"
import { UserRepo } from "./store"
import { CacheUtil, makeCache } from "./cacheutil"

export interface Listing extends Model {
	readonly id: number
	readonly title: string
	readonly description: string
	readonly phone: string
	readonly price: number
	readonly user: number
	readonly category: number
}

async function refreshItemFn(item: Listing, ageInSeconds: number): Promise<Listing | null> {
	let id
	if (typeof item === 'number') {
		id = item
	} else {
		id = item.id
	}
	const data = await fetchJson(`https://api.guloggratis.dk/modules/gg_app/ad/view`, { id })

	if (data.success) {
		let phone = ""
		try {
			phone = data.tlf ? data.tlf.replace(" ", "").replace(/(\+?[0-9]{2})/g, (x: string, _: string, idx: number) => {
				return (idx == 0 ? x : ` ${x}`)
			}).trim() : ""

			UserRepo.saveToCache({ id: data.userid, username: data.username.trim(), phone: phone })

		} catch (e) {
			console.log(data)
		}

		return {
			id: id,
			title: data.headline,
			phone: phone,
			description: data.description,
			price: data.price_value,
			user: data.userid,
			category: data.categoryid,
			// transaction_type: (Object.keys(data.sales_type)[0] == 1 ? "SELL" : "BUY"),
		}
	} else {
		(item as any).status = "offline"
		return item
	}
}


let cache: CacheUtil<Listing>

(async () => {
	cache = await makeCache<Listing>("listing", refreshItemFn, 60 * 60 * 24 * 7)
})()


export class ListingRepo {
	static async find(id: number): Promise<Listing | null> {
		return cache.get(id)
	}

	static async findLatest(category?: number, limit: number = 20): Promise<{ count: number, listings: Listing[] }> {
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
			const listings: Listing[] = []
			for (let id of list) {
				let item = await ListingRepo.find(id)
				if (item) {
					listings.push(item)
				}
			}
			return { count: limit, listings: listings }
		})
	}


	static async search(query: string, category: number, user: number, limit: number = 20): Promise<{ count: number, listings: Listing[] }> {

		query = typeof query === "undefined" ? "" : query
		category = typeof category === "undefined" ? 0 : category
		user = typeof user === "undefined" ? 0 : user

		let memoize = cache.memoize<{ count: number, listings: number[] }>("search", { query, user, category }, {
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
				listings: data.results.map((listing: { id: number }) => listing.id),
			}
		})

		return memoize.then(async (result: { count: number, listings: number[] }) => {
			const listings: Listing[] = []
			for (let id of result.listings.slice(0, limit)) {
				let item = await  ListingRepo.find(id)
				if (item) {
					listings.push(item)
				}
			}
			return {
				count: result.count,
				listings: listings,
			}
		})
	}

	static saveToCache(listing: Listing): void {
		cache.update(listing)
	}
}
