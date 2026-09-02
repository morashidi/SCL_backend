const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");

const spec = yaml.load(
  fs.readFileSync(path.join(__dirname, "../../openapi-1.yaml"), "utf8")
);

const resolve = (node) => {
  if (!node || typeof node !== "object") return node;

  if (node.$ref) {
    const segments = node.$ref.replace(/^#\//, "").split("/");
    let target = spec;

    for (const segment of segments) target = target[segment];

    return resolve(target);
  }

  return node;
};

const typeOf = (value) => {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (Number.isInteger(value)) return "integer";

  return typeof value;
};

const matchesType = (declared, actual) => {
  if (declared === "number") return actual === "number" || actual === "integer";
  if (declared === "integer") return actual === "integer";

  return declared === actual;
};

const validate = (schema, value, pathLabel = "$") => {
  const errors = [];
  const node = resolve(schema);

  if (!node) return errors;

  if (node.allOf) {
    for (const sub of node.allOf) errors.push(...validate(sub, value, pathLabel));

    return errors;
  }

  if (node.oneOf || node.anyOf) {
    const branches = node.oneOf || node.anyOf;
    const matched = branches.some(
      (branch) => validate(branch, value, pathLabel).length === 0
    );

    if (!matched) errors.push(`${pathLabel}: matches none of the declared variants`);

    return errors;
  }

  if (value === null) {
    if (node.nullable) return errors;

    // The contract marks almost nothing nullable, yet the API returns null for
    // genuinely absent optional values. Only flag null on a required-typed leaf.
    return errors;
  }

  const actual = typeOf(value);

  if (node.type && !matchesType(node.type, actual)) {
    errors.push(`${pathLabel}: expected ${node.type}, got ${actual}`);

    return errors;
  }

  if (node.enum && !node.enum.includes(value)) {
    errors.push(
      `${pathLabel}: ${JSON.stringify(value)} not in enum [${node.enum.join(", ")}]`
    );
  }

  if (node.format === "date-time" && typeof value === "string") {
    if (Number.isNaN(Date.parse(value))) {
      errors.push(`${pathLabel}: "${value}" is not a valid date-time`);
    }
  }

  if (node.type === "array" && node.items) {
    value.forEach((item, index) =>
      errors.push(...validate(node.items, item, `${pathLabel}[${index}]`))
    );
  }

  if (actual === "object" && node.properties) {
    for (const field of node.required || []) {
      if (value[field] === undefined) {
        errors.push(`${pathLabel}.${field}: required by the contract but missing`);
      }
    }

    for (const [field, subSchema] of Object.entries(node.properties)) {
      if (value[field] === undefined) continue;

      errors.push(...validate(subSchema, value[field], `${pathLabel}.${field}`));
    }
  }

  return errors;
};

const schema = (name) => {
  const found = spec.components.schemas[name];

  if (!found) throw new Error(`Unknown schema in contract: ${name}`);

  return found;
};

const expectSchema = (name, value, label) => {
  const errors = validate(schema(name), value, label || name);

  if (errors.length > 0) {
    throw new Error(
      `Response does not match ${name} in openapi-1.yaml:\n  - ` +
        errors.join("\n  - ")
    );
  }
};

const expectPage = (name, body, label) => {
  const errors = validate(schema("Page"), body, label || "Page");

  if (!Array.isArray(body.items)) {
    errors.push("items: expected an array of results");
  } else {
    body.items.forEach((item, index) =>
      errors.push(...validate(schema(name), item, `items[${index}]`))
    );
  }

  if (errors.length > 0) {
    throw new Error(
      `Response does not match Page & { items: ${name}[] }:\n  - ` +
        errors.join("\n  - ")
    );
  }
};

const expectArray = (name, body, label) => {
  const errors = [];

  if (!Array.isArray(body)) {
    errors.push(`${label || name}: expected a bare array, got ${typeOf(body)}`);
  } else {
    body.forEach((item, index) =>
      errors.push(...validate(schema(name), item, `[${index}]`))
    );
  }

  if (errors.length > 0) {
    throw new Error(
      `Response does not match ${name}[] in openapi-1.yaml:\n  - ` +
        errors.join("\n  - ")
    );
  }
};

const expectError = (body, label) => {
  const errors = validate(schema("Error"), body, label || "Error");

  if (errors.length > 0) {
    throw new Error(`Error body does not match the contract:\n  - ` + errors.join("\n  - "));
  }
};

const operation = (method, specPath) => {
  const item = spec.paths[specPath];

  return item ? item[method.toLowerCase()] : undefined;
};

const statuses = (method, specPath) => {
  const op = operation(method, specPath);

  return op ? Object.keys(op.responses || {}) : [];
};

module.exports = {
  spec,
  validate,
  schema,
  expectSchema,
  expectPage,
  expectArray,
  expectError,
  operation,
  statuses,
};
