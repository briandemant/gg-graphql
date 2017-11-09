import fake from "./fake"
import { Model } from "./model"
import { ListingRepo } from "./listing"
import { CacheUtil, makeCache } from "./cacheutil"

let FORCE_REFRESH_ITEMS = 24 * 60 * 60


export interface User extends Model {
	id: number
	username: string
	phone: string
	has_nemid: boolean
	avatar: number | null,
	createdAt: number
	updatedAt: number
}

function fakeUser(id: number): User {
	return {
		id,
		username: fake.username(id),
		phone: fake.phone(id),
		has_nemid: false,
		avatar: null,
		createdAt: 0,
		updatedAt: Date.now(),
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


export class UserRepo {
	static async find(id: number): Promise<User> {
		let user = await cache.get(id)
		if (!user) {
			user = fakeUser(id)
		}
		if (!user.createdAt) {
			(user as { createdAt: number }).createdAt = Date.now() - Math.random() * 1000 * 24 * 60 * 60 * 1000
		}
		return user
	}

	static async listings(id: number, limit: number) {
		let x = await ListingRepo.search("", 0, id, limit)
		return x.results
	}

	static saveToCache(user: User) {
		cache.update(user)
	}
}