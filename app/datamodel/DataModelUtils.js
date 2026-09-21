export function findByClassName(parent, className) {
  if (!parent) return undefined;
  const list = Array.isArray(parent) ? parent : parent.Children || [];
  for (const child of list) {
    if (child && child.ClassName === className) return child;
  }
  return undefined;
}

export function findAllByClassName(parent, className, out = []) {
  const list = Array.isArray(parent) ? parent : parent.Children || [];
  for (const child of list) {
    if (!child) continue;
    if (child.ClassName === className) out.push(child);
    if (child.Children) findAllByClassName(child.Children, className, out);
  }
  return out;
}

export function instance(className, name, props = {}, children = []) {
  return {
    ClassName: className,
    Name: name || className,
    Archivable: true,
    Children: children,
    ...props,
  };
}
