/**
 * ComfyUI graph builder DSL — mirrors the Rust GraphBuilder.
 *
 * Build a workflow programmatically by chaining node/input/link calls,
 * then call `finalize()` to produce the JSON object ComfyUI expects at `/prompt`.
 *
 * @example
 * const g = new GraphBuilder();
 * const ckpt = g.node("1", "CheckpointLoaderSimple")
 *   .input("ckpt_name", "model.safetensors")
 *   .outputs(3); // MODEL, CLIP, VAE
 *
 * g.node("2", "CLIPTextEncode")
 *   .input("text", "a cat")
 *   .link("clip", ckpt[1])
 *   .outputs(1);
 *
 * const workflow = g.finalize();
 */

type ScalarInput = string | number | boolean;
type LinkInput = [nodeId: string, slot: number];
type InputValue = ScalarInput | LinkInput;

interface NodeDef {
  class_type: string;
  inputs: Record<string, InputValue>;
}

/** A reference to one output slot of a node — passed to `.link()` on another node. */
export interface NodeOutput {
  readonly nodeId: string;
  readonly slot: number;
}

/** Fluent builder for a single node. Returned by `GraphBuilder.node()`. */
export class NodeBuilder {
  constructor(
    private readonly nodes: Map<string, NodeDef>,
    private readonly id: string,
  ) {}

  /** Set a constant scalar input (string, number, boolean). */
  input(name: string, value: ScalarInput): this {
    this.nodes.get(this.id)!.inputs[name] = value;
    return this;
  }

  /** Connect an input to another node's output slot (creates a link). */
  link(name: string, output: NodeOutput): this {
    this.nodes.get(this.id)!.inputs[name] = [output.nodeId, output.slot];
    return this;
  }

  /**
   * Finish building this node and return handles to its output slots.
   * `count` must match the number of outputs the ComfyUI node type produces.
   */
  outputs(count: number): NodeOutput[] {
    const { id } = this;
    return Array.from({ length: count }, (_, slot) => ({ nodeId: id, slot }));
  }
}

/** Programmatic workflow graph builder. */
export class GraphBuilder {
  private readonly nodes = new Map<string, NodeDef>();

  /** Add a new node to the graph and return its builder. */
  node(id: string, classType: string): NodeBuilder {
    this.nodes.set(id, { class_type: classType, inputs: {} });
    return new NodeBuilder(this.nodes, id);
  }

  /** Produce the JSON object ComfyUI's `/prompt` endpoint expects. */
  finalize(): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [id, node] of this.nodes) {
      result[id] = {
        class_type: node.class_type,
        inputs: { ...node.inputs },
      };
    }
    return result;
  }
}
