module.exports = ({ Category, User, Listing }) => {


	return {
		Query: {
			category: (root, { id }, ctx) => Category.find(id),
			user: (root, { id }, ctx) => User.find(id),
			listing: (root, { id }, ctx) => Listing.find(id),
		},

		Category: {},
		User: {},
		Listing: {
			user: ({ user }) => User.find(user),
			category: ({ category }) => Category.find(category),
		},

	}
}