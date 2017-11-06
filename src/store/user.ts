import fake from "./fake"
import { Model } from "./model"
import { CacheUtil, makeCache } from "./cacheutil"


function fakeUser(id: number): User {
	return { id, username: fake.username(id), phone: fake.phone(id), nemid_validated: false }
}

async function refreshItemFn(user: User | number, ageInSeconds: number): Promise<User | null> {

	if (typeof  user === "number") return fakeUser(user)

	return null
}

let cache: CacheUtil<User>
(async () => {
	cache = await makeCache<User>("user", refreshItemFn, 60 * 60 * 24 * 365)
})()

export interface User extends Model {
	readonly id: number
	readonly username: string
	readonly phone: string
	readonly nemid_validated: boolean
}

export class UserRepo {
	static async find(id: number): Promise<User | null> {
		return cache.get(id)
	}

	static saveToCache(user: User): void {
		cache.update(user)
	}
}