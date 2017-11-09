import { Category, CategoryRepo } from "../store/category"
import { ListingRepo } from "../store/listing"
import { UserRepo } from "../store/user"
import { ImageRepo, ImageSizeType, toImageUrl } from "../store/image"
import { Model } from "../store/model"
import { shuffle } from "lodash"

type IdType = { id: number }
type Context = {}
type Root = any
type Meta = {
	fieldName: {},
	fieldNodes: {},
	returnType: {},
	parentType: {},
	path: {},
	schema: {},
	fragments: {},
	rootValue: {},
	operation: {},
	variableValues: {},
}

type Result = Model | null
type ResultList = { count: number, results: Model[] }

type IdAndSize = { id: number, size: ImageSizeType }

type QueryParams = { query: string, limit: number, category: number, user: number }

function toDateOrNull(createdAt: number | null) {
	if (!createdAt || createdAt <= 0) {
		return ""
	}
	return new Date(createdAt).toISOString()
}

export default () => {
	// noinspection TsLint
	return {
		Query: {
			category: (_: Root, { id }: IdType): Promise<Result> => {
				return CategoryRepo.find(id)
			},

			category_roots: (): Promise<Result[]> => {
				return CategoryRepo.roots()
			},

			user: (_: Root, { id }: IdType): Promise<Result> => {
				return UserRepo.find(id)
			},

			image: (_: Root, { id, size }: IdAndSize): Promise<Result> => {
				return ImageRepo.find(id, size)
			},
			listing: (_: Root, { id }: IdType): Promise<Result> => {
				return ListingRepo.find(id)
			},
			listing_latest: (_: Root, { limit, category }: QueryParams): Promise<ResultList> => {
				return ListingRepo.latest(category, limit)
			},
			listing_front: (_: Root, { limit }: QueryParams,): Promise<ResultList> => {
				return ListingRepo.front(limit)
			},
			listing_search: (_: Root, { query, limit, category, user }: QueryParams): Promise<ResultList> => {
				return ListingRepo.search(query, category, user, limit)
			},
		},

		Category: {
			parents: ({ parents }: any) => parents.map((id: number) => CategoryRepo.find(id)),
			parent: ({ parents }: any) => parents.length > 0 ? CategoryRepo.find(parents[0]) : null,
			children: ({ children }: any, { with_count }: any) => {
				return children.map((id: number) => CategoryRepo.find(id)).filter((cat: Category) => !with_count || cat.count > 0)
			},
			createdAt: ({ createdAt }: any) => toDateOrNull(createdAt),
			updatedAt: ({ updatedAt }: any) => toDateOrNull(updatedAt),
		},

		User: {
			avatar: ({ avatar }: { avatar: number | null }, { size }: { size: ImageSizeType }) => {
				return avatar ? ImageRepo.find(avatar, size) : avatar
			},

			listings: async (root: Root, { limit }: any) => {
				return UserRepo.listings(root.user.id, limit)
			},
			createdAt: ({ createdAt }: any) => toDateOrNull(createdAt),
			updatedAt: ({ updatedAt }: any) => toDateOrNull(updatedAt),
		},

		Image: {
			url: ({ id, size }: IdAndSize) => toImageUrl(id, size),
		},

		Listing: {
			user: ({ user }: any) => UserRepo.find(user),
			category: ({ category }: any) => CategoryRepo.find(category),
			images: (root: Root, { size }: { size: ImageSizeType }) => {

				const { images } = root
				return images.map((id: number) => ImageRepo.find(id, size))
			},
			image: (root: Root, { size }: { size: ImageSizeType }) => {

				const { images } = root
				if (images.length > 0) {
					return ImageRepo.find(images[0], size)
				} else {
					return null
				}
			},
			related: async (root: Root, { limit }: { limit: number | null }, ctx: Context, meta: Meta) => {
				limit = limit || 20
				const { id, category } = root
				// get too many so that we can shuffle
				let res = await ListingRepo.search("", category, 0, limit * 4)

				let related = res.results.filter(listing => listing.id !== id)

				return shuffle(related).slice(0, limit)
			},

			createdAt: ({ createdAt }: any) => toDateOrNull(createdAt),
			updatedAt: ({ updatedAt }: any) => toDateOrNull(updatedAt),
			expiresAt: ({ expiresAt }: any) => toDateOrNull(expiresAt),
		},
	}
}