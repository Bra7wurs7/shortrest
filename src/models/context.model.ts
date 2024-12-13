export interface Context {
  collapsed: boolean;
  visible: boolean;
  type: "static" | "dynamic";
  content: string;
  dynamic_content: string;
  automatic_dynamic: boolean;
}
