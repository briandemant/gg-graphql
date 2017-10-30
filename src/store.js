const fetch = require('node-fetch')
const { promisify } = require('util')
const fs = require('fs')
const zlib = require('zlib')
const readFileAsync = promisify(fs.readFile)
const writeFileAsync = promisify(fs.writeFile)
const unzipAsync = promisify(zlib.unzip)
const gzipAsync = promisify(zlib.gzip)

let categoryCache = { ts: 0 }

const UPDATE_ALL_CATEGORY_INTEVAL = 1000 * 60 * 60 * 24
const UPDATE_CATEGORY_INTEVAL_PR_LVL = 1000 * 20

async function loadAllCategories() {


	function cacheIsStale() {
		return (Date.now() - categoryCache.ts) > UPDATE_ALL_CATEGORY_INTEVAL
	}

	if (cacheIsStale()) {
		try {
			let content

			const gzipped = await readFileAsync("./data/categories.json.gz")
			const buffer = await unzipAsync(new Buffer(gzipped))
			content = buffer.toString()

			categoryCache = JSON.parse(content)
			console.log("category cache loaded")
		} catch (e) {
		}

		if (cacheIsStale()) {
			console.log("updating category cache")
			const result = {
				"updatedAt": new Date(),
				"ts": 0,
				"byId": {
					"0": {
						"children": [],
					},
				},
				"can_create": [],
			}

			categoryCache = await loadCategory(result)
			categoryCache.ts = Date.now()

			if (!process.env.NOW) {
				const gzipped = await gzipAsync(JSON.stringify(categoryCache, null, 2))
				await writeFileAsync("./data/categories.json.gz", gzipped)
			}
			console.log("updating category cache .. Done")
		}
	}

	let sleep = Math.max(UPDATE_ALL_CATEGORY_INTEVAL - (Date.now() - categoryCache.ts) + 100, 60 * 1000)

	setTimeout(() => {
		loadAllCategories()
	}, sleep)
}

async function loadSubCategories(id = 0) {
	console.log("loadSubCategories " + id)
	const childResp = await fetch(`https://mit.guloggratis.dk/modules/gulgratis/ajax/ad_creator.fetch_categories_for_select.php?parent_categoryid=${id}`)
	const children = (await childResp.json()).categories
	return children//.slice(0, 1)
}

async function updateCategory(category) {
	if (category.ts == null || Date.now() - category.ts > UPDATE_CATEGORY_INTEVAL_PR_LVL * (1 + category.level)) {
		console.log("updating ", category.level, category.title, category.count)

		try {
			const catResp = await fetch(`https://mit.guloggratis.dk/modules/gg_app/category/data?id=${category.id}`)
			const catInfo = await catResp.json()
			const countResp = await fetch(`https://api.guloggratis.dk/modules/gg_app/search/result?category_id=${category.id}&pagenr=10000000`)
			const count = await countResp.json()


			category.ts = Date.now()
			category.title = catInfo.name
			category.count = count.nr_results
			category.slug = catInfo.GAScreenValue
			if (catInfo.can_create) {
				category.can_create = true
			}
		} catch (e) {
			console.error(category, e)
		}
	}
}

async function loadCategory(result, level = 0, id = 0) {
	console.log("\nloadCategory " + id, level)

	try {
		if (id > 0 && result["byId"][id]) {
			await updateCategory(result["byId"][id])
			if (result["byId"][id].can_create) {
				result["can_create"].push(id)
			}
		}
		// if (level > 2) return
		if (!result["byId"][id]["can_create"]) {
			const children = await loadSubCategories(id)
			result["byId"][id]["children"] = children.map(x => x.categoryid)
			for (let child of children) {
				const childId = child.categoryid

				result["byId"][childId] = {
					id: childId,
					ts: 0,
					level: level,
					title: child.name,
					count: 0,
					slug: result["byId"][id].slug, // inherits from parent until updated
					title_slug: child.path_as_string,
					parents: id > 0 ? [id, ...result["byId"][id].parents] : [],
					children: [],
				}
				await loadCategory(result, level + 1, childId)
			}
		}

	} catch (e) {
		console.error(e)
	}

	return result
}


class Category {
	find(idOrObject) {
		let result
		if (typeof idOrObject == "number") {
			result = categoryCache["byId"][idOrObject]
		} else {
			result = categoryCache["byId"][idOrObject.id]
		}
		if (!result) {
			throw new Error(`Could not find category with id '${idOrObject}'`)
		}

		updateCategory(result)

		return result
	}

	roots() {
		return categoryCache["byId"][0].children.map(id => categoryInstance.find(id))
	}
}

class Listing {
	find(id) {
		return fetch(`https://api.guloggratis.dk/modules/gg_app/ad/view?id=${id}`).then((resp) => {
			return resp.json().then((data) => {
				console.log(data)
				return Promise.resolve({
					id,
					title: data.headline,
					description: data.description,
					price: data.price_value,
					user: {
						id: data.userid,
						username: data.username,
					},
					category: {
						id: data.categoryid,
						title: data.category_name,
					},
					transaction_type: (Object.keys(data.sales_type)[0] == 1 ? "SELL" : "BUY"),
				})
			})
		})
	}
}

class User {
	find(id) {
		if (typeof id == "number")
			return Promise.resolve({
				id: id,
				username: `User #${id.toString(16)}`,
			})
		else
			return id
	}
}

const categoryInstance = new Category()
const ListingInstance = new Listing()
const userInstance = new User()

module.exports = async () => {
	loadAllCategories()

	return await Promise.resolve({
		Category: new Category(),
		Listing: new Listing(),
		User: new User(),
	})
}