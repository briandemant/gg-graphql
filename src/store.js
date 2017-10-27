const fetch = require('node-fetch')


let categoryData = {
	"byId": {
		"600": {
			"id": 600,
			"title": "Motorcykler og tilbehør",
			"slug": "/transport/motorcykler-og-tilbehor/",
			"parent_titles": [
				"2-hjulet transport",
			],
		},
	},
}

 function loadCateoryTree() {

}

console.log(await loadCateoryTree())
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
	return await Promise.resolve({
		Category: new Category(),
		Listing: new Listing(),
		User: new User(),
	})
}