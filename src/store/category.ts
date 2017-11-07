import { fetchJson } from "../fetch"
import { difference } from "lodash"
import { Model } from "./model"
import { CacheUtil, makeCache } from "./cacheutil"


let FORCE_REFRESH_ITEMS = 24 * 60 * 60

export interface Category extends Model {
	id: number
	count: number
	level: number
	slug: string
	title: string
	title_slug: string
	children: number[]
	parents: number[]
	can_create: boolean,
	extra : {
		listings : number[]
	}
}


async function refreshItemFn(category: Category | number, ageInSeconds: number): Promise<Category | null> {
	if (ageInSeconds < 60) {
		return null
	}

	let id

	if (typeof category === 'number') {
		id = category
		category = {
			id: id,
			level: -1,
			title: '',
			count: 0,
			slug: '/',
			title_slug: '',
			parents: [],
			children: [],
			can_create: false,
			extra : {
				listings :  []
			}
		} as Category
	} else {
		id = category.id
	}

	category.level = category.parents.length

	// else if (ageInSeconds>46)
	// throw new Error("ageInSeconds")
	// console.log("category", id, category.title_slug)
	try {
		const count = await fetchJson(`https://api.guloggratis.dk/modules/gg_app/search/result`, {
			category_id: id,
			pagenr: 100000, // we don't want the results only the count
		})

		category.count = count.nr_results

		if (ageInSeconds < 2 * 60 * 60 || ageInSeconds === 0) {
			// console.log(">>only update count")
			return category
		} else {
			const catInfo = await fetchJson(`https://api.guloggratis.dk/modules/gg_app/category/data`, { id })
			const childInfo = await fetchJson(`https://api.guloggratis.dk/modules/gulgratis/ajax/ad_creator.fetch_categories_for_select.php`, { parent_categoryid: id })

			category.title = catInfo.name
			category.slug = catInfo.GAScreenValue
			const previousChildren = category.children
			category.children = childInfo.categories.map((x: { categoryid: number }) => x.categoryid)
			// category.children = childInfo.categories.slice(0, 4).map(x => x.categoryid)

			// console.log("before", previousChildren)
			// console.log("after", category.children)
			let diff = difference(previousChildren, category.children)  as number[]
			// console.log("difference", diff)
			await removeChildren(diff)

			if (category.id == 0) {
				category.level = -1
			} else {
				category.level = category.parents.length
				if (category.level === 0) {
					category.title_slug = category.title
				}
			}

			if (catInfo.can_create) {
				category.can_create = true
			}

			for (let childId of category.children) {
				const child = await cache.get(childId, false)
				if (category.id > 0 && child) {
					if (category.parents.length > 0) {
						child.title_slug = `${category.title_slug}/${child.title}`
						child.parents = [category.id, ...category.parents].filter(x => x > 0)
						child.level = child.parents.length
					} else {
						child.level = 0
						child.title_slug = `${category.title}/${child.title}`
						child.parents = [category.id]
					}
				}
			}

			return category
		}
	} catch (e) {
		console.error(id, category, e)
		;(category as any).status = "error"
		return category
	}
}

async function removeChildren(children: number[]) {
	for (let id of children) {
		let child = await cache.get(id)
		if (child) {
			await removeChildren(child.children)
		}
		cache.remove(id)
	}
}

let cache: CacheUtil<Category>

async function rebuildTree() {
	// CategoryRepo.roots().catch((err) => console.log(err))
	// cache.get(373).catch((err) => console.log(err))
	// cache.get(374).catch((err) => console.log(err))
}


(async () => {
	cache = await makeCache<Category>("category", refreshItemFn, FORCE_REFRESH_ITEMS)

	rebuildTree().catch((err) => console.log(err))
})()


export class CategoryRepo {
	static async find(id: number): Promise<Category | null> {
		return cache.get(id)
	}

	static async roots(): Promise<Category[]> {
		const root = await cache.get(0)
		const result = []
		if (root !== null) {
			for (let childId of root.children) {
				let child = await cache.get(childId)
				if (child) {
					result.push(child)
				}
			}
		}
		return result
	}

	static saveToCache(category: Category): void {
		cache.update(category)
	}
}
