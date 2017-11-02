import fetch from "node-fetch"
export async function fetchJson(url: string, params: {}) {
	var query = Object.keys(params)
	                  .map(k => encodeURIComponent(k) + '=' + encodeURIComponent(params[k]))
	                  .join('&')
	// console.log(url + "?" + query)
	const response = await fetch(url + "?" + query)

	return await response.json()
}