import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  carts: defineTable({
    userId: v.string(),
    items: v.array(v.object({
      id: v.string(), // Product ID
      productId: v.string(), // Keep for backwards compatibility
      title: v.string(), // Product title
      name: v.string(), // Keep for backwards compatibility
      price: v.number(),
      quantity: v.number(),
      image: v.optional(v.string()),
      link: v.optional(v.string()), // Product link
      store: v.optional(v.string()), // Store name
      rating: v.optional(v.number()), // Product rating
    })),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),
});