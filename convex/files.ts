import { ConvexError, v } from "convex/values";
import { mutation, MutationCtx, query, QueryCtx } from "./_generated/server";
import { getUser } from "./users";
import { fileTypes } from "./schema";
import { Id } from "./_generated/dataModel";



export const generateUploadUrl = mutation(async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
        throw new ConvexError('you must be login to create files')
    }
    return await ctx.storage.generateUploadUrl();
});


async function hasAccessToOrg(
    ctx: QueryCtx | MutationCtx,
    tokenIdentifier: string, orgId: string) {
    const user = await getUser(ctx, tokenIdentifier);
    const hasAccess = user.orgIds.includes(orgId) || user.tokenIdentifier.includes(orgId);

    return hasAccess;
}


export const createFile = mutation({
    args: {
        name: v.string(),
        fileId: v.id("_storage"),
        orgId: v.string(),
        type: fileTypes
    },

    async handler(ctx, args) {

        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            throw new ConvexError('you must be login to create files')
        }

        const hasAccess = await hasAccessToOrg(ctx, identity.tokenIdentifier, args.orgId);
        if (!hasAccess) {
            throw new ConvexError("you do not have access to this org")
        }
        await ctx.db.insert('files', {
            name: args.name,
            orgId: args.orgId,
            fileId: args.fileId,
            type: args.type,
        });
    }
});

export const getFiles = query({
    args: v.object({
        orgId: v.string(),
        query: v.optional(v.string()),
        favorites: v.optional(v.boolean()),
    }),
    async handler(ctx, args) {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            return [];
        }
        const hasAccess = await hasAccessToOrg(ctx, identity.tokenIdentifier, args.orgId);
        if (!hasAccess) {
            return [];
        }
        let files = await ctx.db.query("files")
            .withIndex('by_orgId', (q) => q.eq('orgId', args.orgId))
            .collect();

        const query = args.query;
        if (query) {
            files = files.filter(file => file.name.toLowerCase().includes(query.toLowerCase()))
        }

        if (args.favorites) {
            const user = await ctx.db.query("users").withIndex('by_tokenIdentifier', 
                q => q.eq("tokenIdentifier", identity.tokenIdentifier)
            ).first();
            
            if (!user) {
                return files;
            }
            
            const favorites = await ctx.db.query("favorites").withIndex("by_userId_orgId_fileId", q =>
                q.eq("userId", user._id).eq("orgId", args.orgId)
            ).collect();
            
            files = files.filter((file) => favorites.some((favorite) => favorite.fileId === file._id));
            
        }
        return files;
    }
});

export const deleteFile = mutation({
    args: { fileId: v.id("files") },
    async handler(ctx, args) {

        const access = await hasAccessToFile(ctx, args.fileId)
        if (!access) {
            throw new ConvexError("You do not have access to files")
        }
        await ctx.db.delete(args.fileId)
    }
})


export const getFilesWithUrls = query({
    args: {},
    handler: async (ctx) => {
        const files = await ctx.db.query("files").collect();
        const filesWithUrl = await Promise.all(
            files.map(async (file) => ({
                ...file,
                url: await ctx.storage.getUrl(file.fileId),
            }))
        );

        return filesWithUrl;
    },
});


export const toggleFavorite = mutation({
    args: { fileId: v.id("files") },
    async handler(ctx, args) {
        const access = await hasAccessToFile(ctx, args.fileId)
        if (!access) {
            throw new ConvexError("You do not have access to files")
        }
        const favorite = await ctx.db.query("favorites")
            .withIndex('by_userId_orgId_fileId', q =>
                q.eq('userId', access.user._id).eq("orgId", access.file.orgId).eq("fileId", access.file._id)
            ).first();
        if (!favorite) {

            await ctx.db.insert("favorites", {
                fileId: access.file._id,
                userId: access.user._id,
                orgId: access.file.orgId
            })
        } else {
            await ctx.db.delete(favorite._id)
        }

    }
})


async function hasAccessToFile(
    ctx: QueryCtx | MutationCtx,
    fileId: Id<"files">
) {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
        return null;
    }

    const file = await ctx.db.get(fileId);
    if (!file) {
        return null;
    }

    const hasAccess = await hasAccessToOrg(ctx, identity.tokenIdentifier, file.orgId);
    if (!hasAccess) {
        return null;
    }

    const user = await ctx.db.query("users").withIndex('by_tokenIdentifier',
        q => q.eq("tokenIdentifier", identity.tokenIdentifier)
    ).first();
    if (!user) {
        return null;
    }

    return { file, user }
}