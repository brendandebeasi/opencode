import z from "zod"
import { Tool } from "./tool"
import DESCRIPTION_WRITE from "./todowrite.txt"
import { Todo } from "../session/todo"

const parseIfString = (val: unknown) => {
  if (typeof val === "string") {
    try {
      return JSON.parse(val)
    } catch {
      return val
    }
  }
  return val
}

export const TodoWriteTool = Tool.define("todowrite", {
  description: DESCRIPTION_WRITE,
  parameters: z.object({
    todos: z.preprocess(parseIfString, z.array(z.object(Todo.Info.shape)).describe("The updated todo list")),
  }),
  formatValidationError(error: z.ZodError) {
    const err = error as any
    const todosError = err.errors.find((e: any) => e.path[0] === "todos" && e.code === "invalid_type")
    if (todosError && todosError.message.includes("expected array, received string")) {
      return `The todowrite tool received stringified JSON instead of a proper array. Please provide the todos parameter as a JSON array, not as a string. Example: {"todos": [{"id": "1", "content": "Task", "status": "pending", "priority": "medium"}]}`
    }

    const messages = err.errors.map((e: any) => {
      if (e.path.length === 0 && e.code === "invalid_type") {
        return "The tool arguments must be a JSON object with a 'todos' property"
      }
      if (e.path[0] === "todos" && e.code === "invalid_type") {
        return "The 'todos' parameter must be an array of todo objects"
      }
      if (e.path[1] !== undefined && typeof e.path[1] === "number") {
        const field = e.path[2]
        const index = e.path[1]
        return `Todo at index ${index}: ${field} ${e.message}`
      }
      return `${e.path.join(".")}: ${e.message}`
    })

    return messages.join("\n")
  },
  async execute(params, ctx) {
    await ctx.ask({
      permission: "todowrite",
      patterns: ["*"],
      always: ["*"],
      metadata: {},
    })

    const todosArray = Array.isArray(params.todos) ? params.todos : []

    await Todo.update({
      sessionID: ctx.sessionID,
      todos: todosArray,
    })
    return {
      title: `${todosArray.filter((x) => x.status !== "completed").length} todos`,
      output: JSON.stringify(todosArray, null, 2),
      metadata: {
        todos: todosArray,
      },
    }
  },
})

export const TodoReadTool = Tool.define("todoread", {
  description: "Use this tool to read your todo list",
  parameters: z.object({}),
  async execute(_params, ctx) {
    await ctx.ask({
      permission: "todoread",
      patterns: ["*"],
      always: ["*"],
      metadata: {},
    })

    const todos = await Todo.get(ctx.sessionID)
    const todosArray = Array.isArray(todos) ? todos : []
    return {
      title: `${todosArray.filter((x) => x.status !== "completed").length} todos`,
      metadata: {
        todos: todosArray,
      },
      output: JSON.stringify(todosArray, null, 2),
    }
  },
})
