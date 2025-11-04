import { durable } from "@dsqr/durable-lambda"

interface CounterState {
  count: number
}

/**
 * Counter Durable Object
 *
 * This example mirrors Cloudflare's Durable Objects API style.
 * Each actor instance maintains its own isolated counter state.
 */
export const handler = durable<CounterState>(async (ctx, request) => {
  // Initialize state if needed (like constructor in Cloudflare DO)
  ctx.state.count = ctx.state.count ?? 0

  // Handle different request types (similar to fetch() in Cloudflare DO)
  const { method, action, amount } = request
  let response: any = { count: ctx.state.count, actorId: ctx.actorId }

  switch (method || action) {
    case "GET":
    case "get":
      // Return current count without modifying
      response = { count: ctx.state.count, actorId: ctx.actorId }
      break

    case "POST":
    case "increment": {
      // Increment counter
      const incrementBy = amount || 1
      ctx.state.count += incrementBy

      console.log(
        `[${ctx.actorId}] Incremented by ${incrementBy}, new count: ${ctx.state.count}`,
      )

      // Persist state (automatic in Cloudflare, explicit here)
      await ctx.save()

      response = {
        count: ctx.state.count,
        actorId: ctx.actorId,
        incremented: incrementBy,
      }
      break
    }

    case "PUT":
    case "set": {
      // Set counter to specific value
      const oldCount = ctx.state.count
      ctx.state.count = amount || 0

      console.log(`[${ctx.actorId}] Set from ${oldCount} to ${ctx.state.count}`)

      await ctx.save()

      response = {
        count: ctx.state.count,
        previousCount: oldCount,
      }
      break
    }

    case "DELETE":
    case "reset": {
      // Reset counter
      const wasCount = ctx.state.count
      ctx.state.count = 0

      console.log(`[${ctx.actorId}] Reset from ${wasCount} to 0`)

      await ctx.save()

      response = {
        count: 0,
        resetFrom: wasCount,
      }
      break
    }

    case "decrement": {
      // Decrement counter
      const decrementBy = amount || 1
      ctx.state.count -= decrementBy

      console.log(
        `[${ctx.actorId}] Decremented by ${decrementBy}, new count: ${ctx.state.count}`,
      )

      await ctx.save()

      response = {
        count: ctx.state.count,
        decremented: decrementBy,
      }
      break
    }

    default: {
      // Unknown method
      response = {
        error: `Unknown method: ${method || action}`,
        supportedMethods: [
          "GET",
          "POST",
          "PUT",
          "DELETE",
          "increment",
          "decrement",
          "set",
          "reset",
        ],
      }
      break
    }
  }

  // Return response for sync calls
  return response
})
