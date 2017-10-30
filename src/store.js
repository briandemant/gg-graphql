const fetch = require('node-fetch')
const { promisify } = require('util')
const fs = require('fs')
const [readFileAsync, writeFileAsync] = [promisify(fs.readFile), promisify(fs.writeFile)]

let categoryData = {}

const UPDATE_CATEGORY_INTEVAL = 1000 * 120

async function loadAllCategories() {
	let saved = {    }
	try {
		saved = JSON.parse(await readFileAsync("./categories.json", "utf8"))
	} catch (e) {
	}
	console.log("saved.updated", saved.updated)

	let secondsSinceLastUpdate = Date.now() - (saved.ts|0)
	console.log("secondsSinceLastUpdate", secondsSinceLastUpdate)
	if (secondsSinceLastUpdate > UPDATE_CATEGORY_INTEVAL) {
		console.log("loadAllCategories")

		const result = {
			"ts": Date.now(),
			"updated": new Date(),
			"byId": {
				"0": {
					"id": 0,
					"lvl": -1,
					"title": "",
					"slug": "/",
					"parents": [],
					"children": [],
				},
			},
			"can_create": [],
		}

		categoryData = await loadCategory(result)
		await writeFileAsync("./categories.json", JSON.stringify(categoryData, null, 2))
		console.log("Done")
	}
	setTimeout(() => {
		loadAllCategories()
	}, UPDATE_CATEGORY_INTEVAL - secondsSinceLastUpdate + 100)
}

async function loadSubCategories(id = 0) {
	// console.log("loadSubCategories " + id)
	const childResp = await fetch(`https://mit.guloggratis.dk/modules/gulgratis/ajax/ad_creator.fetch_categories_for_select.php?parent_categoryid=${id}`)
	const children = (await childResp.json()).categories
	return children.slice(0, 1)
}

async function loadCategory(result, lvl = 0, id = 0) {
	// console.log("\nloadCategory " + id, lvl)
	try {
		if (id > 0) {
			const catResp = await fetch(`https://api.guloggratis.dk/modules/gg_app/category/data?id=${id}`)
			const cat = await catResp.json()
			delete cat.adserving_keywords
			delete cat.facets
			delete cat.category_fields
			// console.log("cat", cat)
			result["byId"][id]["title"] = cat.name
			result["byId"][id]["count"] = cat.results
			result["byId"][id]["slug"] = cat.GAScreenValue

			if (cat.payment_category) {
				console.log("payment", id, cat.name)
				console.log(cat.payment_category_info_text)
			}
			if (cat.can_create) {
				result["can_create"].push(id)
				result["byId"][id]["can_create"] = cat.can_create
			}
		}
		// if (lvl > 2) return
		if (!result["byId"][id]["can_create"]) {
			const children = await loadSubCategories(id)
			result["byId"][id]["children"] = children.map(x => x.categoryid)
			for (let child of children) {
				const childId = child.categoryid

				result["byId"][childId] = {
					id: childId,
					lvl,
					"title": child.name,
					"count": 0,
					"slug": "/",
					"title_slug": child.path_as_string,
					"parents": id > 0 ? [id, ...result["byId"][id].parents] : [],
					"children": [],
				}
				await loadCategory(result, lvl + 1, childId)
			}
		}

	} catch (e) {
		console.log(e)
	}

	return result
}


class Category {
	find(id) {
		if (typeof id == "number")
			return Promise.resolve({
				id: id,
				title: `Category #${id.toString(16)}`,
			})
		else
			return id
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

module.exports = async () => {
	loadAllCategories()


	return await Promise.resolve({
		Category: new Category(),
		Listing: new Listing(),
		User: new User(),
	})
}