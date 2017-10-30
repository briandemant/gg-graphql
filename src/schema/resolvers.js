module.exports = ({ Category, User, Listing }) => {


	return {
		Query: {
			category: (root, { id }, ctx) => Category.find(id),
			category_roots: (root, { id }, ctx) => Category.roots(),
			user: (root, { id }, ctx) => User.find(id),
			listing: (root, { id }, ctx) => Listing.find(id),
		},

		Category: {
			parents: ({ parents }) => parents.map(id => Category.find(id)),
			children: ({ children }, { with_count }) => {
				return children.map(id => Category.find(id)).filter((cat) => !with_count || cat.count > 0)
			},
		},
		User: {},
		Listing: {
			user: ({ user }) => User.find(user),
			category: ({ category }) => Category.find(category),
		},
	}
}