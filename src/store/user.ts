import fake from "./fake"
import { Model } from "./model"
import { ListingRepo } from "./listing"
import { CacheUtil, makeCache } from "./cacheutil"

let FORCE_REFRESH_ITEMS = 24 * 60 * 60

function fakeUser(id: number): User {
	return {
		id,
		username: fake.username(id),
		phone: fake.phone(id),
		has_nemid: false,
		avatar: null,

	}
}

async function refreshItemFn(user: User | number, ageInSeconds: number): Promise<User | null> {
	if (ageInSeconds < 5 * 60) {
		return null
	}

	if (typeof  user === "number") {
		return fakeUser(user)
	}

	return null
}

let cache: CacheUtil<User>
(async () => {
	const params = {
		name: "user",
		refreshItemFn: refreshItemFn,
		refreshItemRateInSeconds: FORCE_REFRESH_ITEMS,
	}
	cache = await makeCache<User>(params)
})()

export interface User extends Model {
	readonly id: number
	readonly username: string
	readonly phone: string
	readonly has_nemid: boolean
	readonly avatar: number | null,

}

export class UserRepo {
	static async find(id: number): Promise<User | null> {
		return cache.get(id)
	}

	static async listings(id: number, limit: number) {
		let x = await ListingRepo.search("", 0, id, limit)
		return x.results
	}

	static saveToCache(user: User) {
		cache.update(user)
	}
}