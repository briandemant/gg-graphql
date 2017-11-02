function phone(id: number) {
	const n = id * 2909
	return ((id % 5) ? "99 " : "+55 99 ") + [6, 7, 8]
		.map((x, i) => `${(n + i) % x + 1 }${(n + i * 13) % (x - i)}`)
		.join(" ")
}

function title(id: number) {
	return `Title #${id}`
}

function username(id: number) {
	return `Username #${id}`
}

export default { phone, title, username }