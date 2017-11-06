import { Category, CategoryRepo } from '../store/category'
import { ListingRepo } from '../store/listing'
import { UserRepo } from '../store/user'
import { ImageRepo, ImageSizeType, toImageUrl } from '../store/image'
import { Model } from "../store/model"


type IdType = { id: number }
type Context = any
type Root = any
type Meta = {
	fieldName: any,
	fieldNodes: any,
	returnType: any,
	parentType: any,
	path: any,
	schema: any,
	fragments: any,
	rootValue: any,
	operation: any,
	variableValues: any
}

type Result = Model | null
type ResultList = { count: number, results: Model[] }

type IdAndSize = { id: number, size: ImageSizeType }

export default () => {
	return {
		Query: {
			category: (root: Root, { id }: IdType, ctx: Context): Promise<Result> => CategoryRepo.find(id),
			category_roots: (root: Root, { id }: IdType, ctx: Context): Promise<Result[]> => CategoryRepo.roots(),
			user: (root: Root, { id }: IdType, ctx: Context): Promise<Result> => UserRepo.find(id),
			image: (root: Root, { id, size }: IdAndSize, ctx: Context): Promise<Result> => ImageRepo.find(id, size),
			listing: (root: Root, { id }: IdType, ctx: Context): Promise<Result> => ListingRepo.find(id),
			listing_latest: (root: Root, { limit, category }: any, ctx: Context): Promise<ResultList> => ListingRepo.latest(category, limit),
			listing_search: (root: Root, { query, limit, category, user }: any, ctx: Context): Promise<ResultList> => ListingRepo.search(query, category, user, limit),
		},

		Category: {
			parents: ({ parents }: any) => parents.map((id: number) => CategoryRepo.find(id)),
			parent: ({ parents }: any) => parents.length > 0 ? CategoryRepo.find(parents[0]) : null,
			children: ({ children }: any, { with_count }: any, x: Context, meta: Meta) => {

				// console.log("\n\nPath", JSON.stringify(meta.path.prev.prev, null, 3))
				// if (meta.path.prev.prev && meta.path.prev.prev.prev && meta.path.prev.prev.prev.prev && meta.path.prev.prev.prev.prev.prev) {
				// 	throw new Error("too many nested children")
				// }

				return children.map((id: number) => CategoryRepo.find(id)).filter((cat: Category) => !with_count || cat.count > 0)
			},
		},

		User: {},

		Image: {
			url: ({ id, size }: IdAndSize) => toImageUrl(id, size),
		},

		Listing: {
			user: ({ user }: any) => UserRepo.find(user),
			category: ({ category }: any) => CategoryRepo.find(category),
			images: (root: Root, { size }: { size: ImageSizeType }, ctx: Context, meta: Meta) => {
				// console.log("root", root)
				// console.log("size", size)
				// console.log("meta", meta)

				const { images } = root
				return images.map((id: number) => ImageRepo.find(id, size))
			},
		},
	}
}