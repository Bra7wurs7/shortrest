import { Accessor, JSXElement } from "solid-js";

export function TestBench(): JSXElement {
  return [
    <div id="TESTBENCH_SIDEBAR">
      <div class="node">
        <div class="node_header">
          <i class="bx bx-square"></i>
        </div>
        <div class="text_message">Nothing to see here yet.</div>
        <div class="node_footer">
          <i class="bx bxs-square"></i>
        </div>
      </div>
    </div>,
  ];
}
