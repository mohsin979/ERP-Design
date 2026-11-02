/* @ds-bundle: {"format":4,"namespace":"HOFPulseDesignSystem_2bfdf3","components":[{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Icon","sourcePath":"components/core/Icon.jsx"},{"name":"IconButton","sourcePath":"components/core/IconButton.jsx"},{"name":"Badge","sourcePath":"components/data-display/Badge.jsx"},{"name":"DataTable","sourcePath":"components/data-display/DataTable.jsx"},{"name":"FilterDropdown","sourcePath":"components/forms/FilterDropdown.jsx"},{"name":"SearchInput","sourcePath":"components/forms/SearchInput.jsx"},{"name":"Select","sourcePath":"components/forms/Select.jsx"},{"name":"TextInput","sourcePath":"components/forms/TextInput.jsx"},{"name":"NavItem","sourcePath":"components/navigation/NavItem.jsx"},{"name":"NavSection","sourcePath":"components/navigation/NavSection.jsx"},{"name":"SegmentedControl","sourcePath":"components/navigation/SegmentedControl.jsx"},{"name":"Tabs","sourcePath":"components/navigation/Tabs.jsx"},{"name":"BoardColumn","sourcePath":"components/surfaces/BoardColumn.jsx"},{"name":"Card","sourcePath":"components/surfaces/Card.jsx"},{"name":"ContactCard","sourcePath":"components/surfaces/ContactCard.jsx"},{"name":"AppBar","sourcePath":"ui_kits/pulse-crm/AppBar.jsx"},{"name":"CONTACTS","sourcePath":"ui_kits/pulse-crm/ContactsView.jsx"},{"name":"ContactsView","sourcePath":"ui_kits/pulse-crm/ContactsView.jsx"},{"name":"PlaceholderView","sourcePath":"ui_kits/pulse-crm/PlaceholderView.jsx"},{"name":"Sidebar","sourcePath":"ui_kits/pulse-crm/Sidebar.jsx"}],"sourceHashes":{"components/core/Button.jsx":"a24cb4084f9a","components/core/Icon.jsx":"ab7be3d62d4b","components/core/IconButton.jsx":"2095f5a3cf69","components/data-display/Badge.jsx":"fec02d47307e","components/data-display/DataTable.jsx":"3254ed540e4b","components/forms/FilterDropdown.jsx":"d7e61ada8890","components/forms/SearchInput.jsx":"be6e4e4c636c","components/forms/Select.jsx":"71be64ad765b","components/forms/TextInput.jsx":"1fa3b7579273","components/navigation/NavItem.jsx":"43cfd8c05eff","components/navigation/NavSection.jsx":"5e71aac4fb77","components/navigation/SegmentedControl.jsx":"7312ab01361b","components/navigation/Tabs.jsx":"520461093eb2","components/surfaces/BoardColumn.jsx":"96e4b4bc56d8","components/surfaces/Card.jsx":"279c90b48049","components/surfaces/ContactCard.jsx":"1700d1be45a8","ui_kits/pulse-crm/AppBar.jsx":"cef22391268c","ui_kits/pulse-crm/ContactsView.jsx":"8dfa3e86dde3","ui_kits/pulse-crm/PlaceholderView.jsx":"a33be1b34580","ui_kits/pulse-crm/Sidebar.jsx":"d6e65c76b965"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.HOFPulseDesignSystem_2bfdf3 = window.HOFPulseDesignSystem_2bfdf3 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/core/Icon.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* Pulse's icon set is a 16px outline family lifted from the Figma source.
   The source vectors live in assets/icons/figma-reference/ (ground truth).
   Runtime rendering uses the closest CDN match — lucide-static — masked to
   currentColor so a glyph inherits its container's colour. See
   readme.md → ICONOGRAPHY for the substitution note. */

const ICON_SLUGS = {
  home: "house",
  contacts: "book-user",
  deals: "handshake",
  tasks: "list-checks",
  companies: "building-2",
  segments: "contact",
  "marketing-emails": "mail",
  agent: "crosshair",
  workflows: "workflow",
  "edit-nav": "pen-line",
  search: "search",
  plus: "plus",
  filter: "list-filter",
  sort: "arrow-down-narrow-wide",
  settings: "settings",
  "chevron-down": "chevron-down",
  "chevron-up": "chevron-up",
  "chevron-right": "chevron-right",
  more: "ellipsis-vertical",
  board: "kanban",
  table: "table-2",
  bell: "bell",
  phone: "phone-call",
  help: "circle-help",
  sparkle: "sparkles",
  mail: "mail",
  "mail-open": "mail-open",
  user: "user-round",
  "external-link": "external-link",
  note: "square-pen",
  checklist: "list-todo",
  alert: "circle-alert",
  pencil: "pencil-line",
  calendar: "calendar",
  check: "check",
  close: "x",
  trash: "trash-2",
  download: "download"
};
const ICON_BASE = "https://unpkg.com/lucide-static@0.454.0/icons/";
function Icon({
  name,
  size = 16,
  color,
  strokeWidth,
  style,
  ...rest
}) {
  const slug = ICON_SLUGS[name] || name;
  const url = `url("${ICON_BASE}${slug}.svg")`;
  return /*#__PURE__*/React.createElement("span", _extends({
    "aria-hidden": "true",
    "data-icon": name,
    style: {
      display: "inline-block",
      flex: "0 0 auto",
      width: size,
      height: size,
      backgroundColor: color || "currentColor",
      WebkitMaskImage: url,
      maskImage: url,
      WebkitMaskSize: "contain",
      maskSize: "contain",
      WebkitMaskRepeat: "no-repeat",
      maskRepeat: "no-repeat",
      WebkitMaskPosition: "center",
      maskPosition: "center",
      ...style
    }
  }, rest));
}
Object.assign(__ds_scope, { Icon });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Icon.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const pulseButtonBase = {
  boxSizing: "border-box",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "var(--space-6)",
  height: "var(--control-h)",
  borderRadius: "var(--radius-8)",
  fontFamily: "var(--font-sans)",
  fontSize: "var(--size-12)",
  lineHeight: "var(--leading-14)",
  whiteSpace: "nowrap",
  cursor: "pointer",
  overflow: "hidden",
  transition: "var(--transition-control)"
};
const pulseButtonVariants = {
  primary: {
    background: "var(--action-primary-bg)",
    border: "var(--border-1) solid var(--action-primary-bg)",
    color: "var(--action-primary-fg)"
  },
  secondary: {
    background: "var(--action-secondary-bg)",
    border: "var(--border-default)",
    color: "var(--action-secondary-fg)"
  },
  ghost: {
    background: "transparent",
    border: "var(--border-1) solid transparent",
    color: "var(--action-ghost-fg)",
    fontWeight: "var(--weight-medium)",
    borderRadius: "var(--radius-4)"
  }
};
function Button({
  children,
  variant = "primary",
  icon,
  iconAfter,
  disabled = false,
  fullWidth = false,
  style,
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  const [down, setDown] = React.useState(false);
  const v = pulseButtonVariants[variant] || pulseButtonVariants.primary;
  const hoverBg = variant === "primary" ? down ? "var(--action-primary-bg-active)" : "var(--action-primary-bg-hover)" : variant === "secondary" ? down ? "var(--action-secondary-bg-active)" : "var(--action-secondary-bg-hover)" : "var(--action-ghost-bg-hover)";
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    disabled: disabled,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => {
      setHover(false);
      setDown(false);
    },
    onMouseDown: () => setDown(true),
    onMouseUp: () => setDown(false),
    style: {
      ...pulseButtonBase,
      ...v,
      padding: variant === "ghost" ? "8px 12px" : "6px 16px",
      width: fullWidth ? "100%" : undefined,
      ...(hover && !disabled ? {
        background: hoverBg
      } : null),
      ...(disabled ? {
        opacity: 0.4,
        cursor: "default"
      } : null),
      ...style
    }
  }, rest), icon ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: variant === "ghost" ? 12 : 14
  }) : null, children, iconAfter ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: iconAfter,
    size: 12
  }) : null);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/IconButton.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function IconButton({
  icon,
  size = 28,
  iconSize = 14,
  variant = "secondary",
  hairline = false,
  active = false,
  label,
  style,
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  const bare = variant === "bare";
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    "aria-label": label || icon,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      boxSizing: "border-box",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      flex: "0 0 auto",
      width: size,
      height: size,
      padding: 0,
      borderRadius: "var(--radius-8)",
      border: bare ? "var(--border-1) solid transparent" : hairline ? "var(--border-hair)" : "var(--border-default)",
      background: bare ? "transparent" : active ? "var(--action-secondary-bg-active)" : hover ? "var(--action-secondary-bg-hover)" : "var(--surface-card)",
      color: active ? "var(--icon-strong)" : "var(--icon-default)",
      cursor: "pointer",
      overflow: "hidden",
      transition: "var(--transition-control)",
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: iconSize
  }));
}
Object.assign(__ds_scope, { IconButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/IconButton.jsx", error: String((e && e.message) || e) }); }

// components/data-display/Badge.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const pulseBadgeTones = {
  blue: {
    fg: "var(--tone-blue-fg)",
    bg: "var(--tone-blue-bg)",
    bd: "var(--tone-blue-border)"
  },
  orange: {
    fg: "var(--tone-orange-fg)",
    bg: "var(--tone-orange-bg)",
    bd: "var(--tone-orange-border)"
  },
  magenta: {
    fg: "var(--tone-magenta-fg)",
    bg: "var(--tone-magenta-bg)",
    bd: "var(--tone-magenta-border)"
  },
  neutral: {
    fg: "var(--tone-neutral-fg)",
    bg: "var(--tone-neutral-bg)",
    bd: "var(--tone-neutral-border)"
  },
  danger: {
    fg: "var(--tone-danger-fg)",
    bg: "var(--tone-danger-bg)",
    bd: "var(--tone-danger-bg)"
  }
};
function Badge({
  children,
  tone = "blue",
  icon,
  iconAfter,
  divider = false,
  style,
  ...rest
}) {
  const t = pulseBadgeTones[tone] || pulseBadgeTones.blue;
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      boxSizing: "border-box",
      display: "inline-flex",
      alignItems: "center",
      gap: "var(--space-6)",
      minHeight: 20,
      padding: "0 var(--space-8)",
      borderRadius: "var(--radius-pill)",
      border: `var(--border-1) solid ${t.bd}`,
      background: t.bg,
      color: t.fg,
      fontFamily: "var(--font-sans)",
      fontWeight: "var(--weight-medium)",
      fontSize: "var(--size-12)",
      lineHeight: "var(--leading-18)",
      whiteSpace: "nowrap",
      ...style
    }
  }, rest), icon ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 12
  }) : null, /*#__PURE__*/React.createElement("span", null, children), divider ? /*#__PURE__*/React.createElement("span", {
    style: {
      width: 1,
      height: 12,
      background: "currentColor",
      opacity: 0.45
    }
  }) : null, iconAfter ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: iconAfter,
    size: 12
  }) : null);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data-display/Badge.jsx", error: String((e && e.message) || e) }); }

// components/data-display/DataTable.jsx
try { (() => {
function DataTable({
  columns = [],
  rows = [],
  onRowClick,
  style
}) {
  const [hoverRow, setHoverRow] = React.useState(-1);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      boxSizing: "border-box",
      width: "100%",
      borderRadius: "var(--radius-8)",
      border: "var(--border-default)",
      background: "var(--surface-card)",
      overflow: "hidden",
      ...style
    }
  }, /*#__PURE__*/React.createElement("table", {
    style: {
      width: "100%",
      borderCollapse: "collapse",
      fontFamily: "var(--font-sans)"
    }
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", {
    style: {
      background: "var(--surface-control)"
    }
  }, columns.map(c => /*#__PURE__*/React.createElement("th", {
    key: c.key,
    style: {
      boxSizing: "border-box",
      height: "var(--row-h)",
      padding: "0 var(--space-12)",
      textAlign: c.align || "left",
      fontWeight: "var(--weight-medium)",
      fontSize: "var(--size-12)",
      lineHeight: "var(--leading-14)",
      color: "var(--text-secondary)",
      borderBottom: "var(--border-default)",
      whiteSpace: "nowrap",
      width: c.width
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: "var(--space-5)"
    }
  }, c.label, c.sortable ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "chevron-down",
    size: 10
  }) : null))))), /*#__PURE__*/React.createElement("tbody", null, rows.map((r, i) => /*#__PURE__*/React.createElement("tr", {
    key: r.id ?? i,
    onClick: () => onRowClick && onRowClick(r),
    onMouseEnter: () => setHoverRow(i),
    onMouseLeave: () => setHoverRow(-1),
    style: {
      background: hoverRow === i ? "var(--surface-control-hover)" : "transparent",
      cursor: onRowClick ? "pointer" : "default",
      transition: "var(--transition-control)"
    }
  }, columns.map(c => /*#__PURE__*/React.createElement("td", {
    key: c.key,
    style: {
      boxSizing: "border-box",
      height: 36,
      padding: "0 var(--space-12)",
      textAlign: c.align || "left",
      fontSize: "var(--size-12)",
      lineHeight: "var(--leading-18)",
      color: "var(--text-primary)",
      borderBottom: i === rows.length - 1 ? "none" : "var(--border-default)",
      whiteSpace: "nowrap"
    }
  }, c.render ? c.render(r) : r[c.key])))))));
}
Object.assign(__ds_scope, { DataTable });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data-display/DataTable.jsx", error: String((e && e.message) || e) }); }

// components/forms/FilterDropdown.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function FilterDropdown({
  label,
  value,
  active = false,
  icon,
  onClick,
  style,
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      boxSizing: "border-box",
      display: "inline-flex",
      alignItems: "center",
      gap: "var(--space-5)",
      height: "var(--row-h)",
      padding: "8px 12px",
      borderRadius: "var(--radius-4)",
      border: "var(--border-1) solid transparent",
      background: hover ? "var(--action-ghost-bg-hover)" : "transparent",
      fontFamily: "var(--font-sans)",
      fontWeight: "var(--weight-medium)",
      fontSize: "var(--size-12)",
      lineHeight: "var(--leading-14)",
      color: active || value ? "var(--text-primary)" : "var(--action-ghost-fg)",
      whiteSpace: "nowrap",
      cursor: "pointer",
      transition: "var(--transition-control)",
      ...style
    }
  }, rest), icon ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 12
  }) : null, /*#__PURE__*/React.createElement("span", null, value ? `${label}: ${value}` : label), /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "chevron-down",
    size: 12
  }));
}
Object.assign(__ds_scope, { FilterDropdown });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/FilterDropdown.jsx", error: String((e && e.message) || e) }); }

// components/forms/Select.jsx
try { (() => {
function Select({
  value,
  options = [],
  onSelect,
  placeholder = "Select",
  width = 160,
  icon,
  disabled = false,
  style
}) {
  const [open, setOpen] = React.useState(false);
  const [hover, setHover] = React.useState(false);
  const current = options.find(o => (o.value ?? o) === value);
  const text = current ? current.label ?? current : placeholder;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      width,
      ...style
    }
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    disabled: disabled,
    onClick: () => setOpen(o => !o),
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      boxSizing: "border-box",
      display: "flex",
      alignItems: "center",
      gap: "var(--space-6)",
      width: "100%",
      height: "var(--control-h)",
      padding: "0 var(--space-10) 0 var(--space-14)",
      borderRadius: "var(--radius-8)",
      border: "var(--border-default)",
      background: hover ? "var(--action-secondary-bg-hover)" : "var(--surface-card)",
      fontFamily: "var(--font-sans)",
      fontSize: "var(--size-12)",
      lineHeight: "var(--leading-flat)",
      color: current ? "var(--text-primary)" : "var(--text-placeholder)",
      cursor: "pointer",
      opacity: disabled ? 0.5 : 1,
      transition: "var(--transition-control)"
    }
  }, icon ? /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--icon-default)",
      display: "inline-flex"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 14
  })) : null, /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      textAlign: "left",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, text), /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--icon-default)",
      display: "inline-flex"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "chevron-down",
    size: 10
  }))), open ? /*#__PURE__*/React.createElement("div", {
    role: "listbox",
    style: {
      position: "absolute",
      zIndex: 20,
      top: "calc(var(--control-h) + var(--space-4))",
      left: 0,
      minWidth: "100%",
      padding: "var(--space-4)",
      borderRadius: "var(--radius-8)",
      border: "var(--border-default)",
      background: "var(--surface-card)",
      boxShadow: "var(--shadow-raised)"
    }
  }, options.map(o => {
    const v = o.value ?? o;
    const l = o.label ?? o;
    const selected = v === value;
    return /*#__PURE__*/React.createElement("div", {
      key: v,
      role: "option",
      "aria-selected": selected,
      onClick: () => {
        onSelect && onSelect(v);
        setOpen(false);
      },
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "var(--space-8)",
        height: "var(--control-h)",
        padding: "0 var(--space-8)",
        borderRadius: "var(--radius-4)",
        fontFamily: "var(--font-sans)",
        fontSize: "var(--size-12)",
        color: selected ? "var(--text-primary)" : "var(--text-secondary)",
        cursor: "pointer"
      },
      onMouseEnter: e => e.currentTarget.style.background = "var(--surface-control-hover)",
      onMouseLeave: e => e.currentTarget.style.background = "transparent"
    }, /*#__PURE__*/React.createElement("span", null, l), selected ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
      name: "check",
      size: 12
    }) : null);
  })) : null);
}
Object.assign(__ds_scope, { Select });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Select.jsx", error: String((e && e.message) || e) }); }

// components/forms/TextInput.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function TextInput({
  value,
  onChange,
  placeholder,
  icon,
  iconAfter,
  label,
  width,
  disabled = false,
  surface = "card",
  style,
  ...rest
}) {
  const [focus, setFocus] = React.useState(false);
  return /*#__PURE__*/React.createElement("label", {
    style: {
      boxSizing: "border-box",
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-4)",
      width: width || "100%"
    }
  }, label ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: "var(--size-10)",
      lineHeight: "var(--leading-flat)",
      color: "var(--text-secondary)"
    }
  }, label) : null, /*#__PURE__*/React.createElement("span", {
    style: {
      boxSizing: "border-box",
      display: "flex",
      alignItems: "center",
      gap: "var(--space-4)",
      height: "var(--control-h)",
      padding: "0 var(--space-14)",
      borderRadius: "var(--radius-8)",
      border: "var(--border-default)",
      borderColor: focus ? "var(--focus-border)" : "var(--color-grey-200)",
      boxShadow: focus ? "var(--focus-ring)" : "none",
      background: surface === "control" ? "var(--surface-control)" : "var(--surface-card)",
      color: "var(--icon-default)",
      opacity: disabled ? 0.5 : 1,
      transition: "var(--transition-control)",
      ...style
    }
  }, icon ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 14
  }) : null, /*#__PURE__*/React.createElement("input", _extends({
    value: value,
    onChange: onChange,
    placeholder: placeholder,
    disabled: disabled,
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    style: {
      flex: 1,
      minWidth: 0,
      border: "none",
      outline: "none",
      background: "transparent",
      fontFamily: "var(--font-sans)",
      fontSize: "var(--size-12)",
      lineHeight: "var(--leading-flat)",
      color: "var(--text-primary)"
    }
  }, rest)), iconAfter ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: iconAfter,
    size: 16
  }) : null));
}
Object.assign(__ds_scope, { TextInput });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/TextInput.jsx", error: String((e && e.message) || e) }); }

// components/forms/SearchInput.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function SearchInput({
  placeholder = "Search ( / )",
  iconPosition = "trailing",
  width = 215,
  surface = "card",
  ...rest
}) {
  return /*#__PURE__*/React.createElement(__ds_scope.TextInput, _extends({
    placeholder: placeholder,
    width: width,
    surface: surface,
    icon: iconPosition === "leading" ? "search" : undefined,
    iconAfter: iconPosition === "trailing" ? "search" : undefined
  }, rest));
}
Object.assign(__ds_scope, { SearchInput });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/SearchInput.jsx", error: String((e && e.message) || e) }); }

// components/navigation/NavItem.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function NavItem({
  icon,
  children,
  active = false,
  onClick,
  style,
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      boxSizing: "border-box",
      display: "flex",
      alignItems: "center",
      gap: "var(--space-8)",
      width: "100%",
      height: "var(--nav-item-h)",
      padding: "6px 8px",
      borderRadius: "var(--radius-8)",
      border: "none",
      background: active ? "var(--surface-selected)" : hover ? "var(--surface-control-hover)" : "transparent",
      fontFamily: "var(--font-sans)",
      fontSize: "var(--size-12)",
      lineHeight: "var(--leading-flat)",
      color: active ? "var(--text-inverse)" : "var(--text-primary)",
      textAlign: "left",
      cursor: "pointer",
      transition: "var(--transition-control)",
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      minWidth: "var(--icon-16)",
      color: active ? "var(--icon-inverse)" : "var(--icon-default)"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 16
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      whiteSpace: "nowrap"
    }
  }, children));
}
Object.assign(__ds_scope, { NavItem });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/NavItem.jsx", error: String((e && e.message) || e) }); }

// components/navigation/NavSection.jsx
try { (() => {
function NavSection({
  title,
  children,
  defaultOpen = true,
  style
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      alignSelf: "stretch",
      width: "100%",
      ...style
    }
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setOpen(o => !o),
    style: {
      boxSizing: "border-box",
      display: "flex",
      alignItems: "center",
      gap: "var(--space-4)",
      height: "var(--eyebrow-h)",
      padding: "6px 12px",
      border: "none",
      background: "transparent",
      fontFamily: "var(--font-sans)",
      fontSize: "var(--size-10)",
      lineHeight: "var(--leading-24)",
      color: "var(--text-secondary)",
      cursor: "pointer"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: open ? "chevron-down" : "chevron-right",
    size: 10
  }), /*#__PURE__*/React.createElement("span", null, title)), open ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-6)"
    }
  }, children) : null);
}
Object.assign(__ds_scope, { NavSection });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/NavSection.jsx", error: String((e && e.message) || e) }); }

// components/navigation/SegmentedControl.jsx
try { (() => {
function SegmentedControl({
  options = [],
  value,
  onChange,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    role: "tablist",
    style: {
      boxSizing: "border-box",
      display: "inline-flex",
      alignItems: "center",
      gap: "var(--space-1-75)",
      height: "var(--control-h)",
      borderRadius: "var(--radius-8)",
      border: "var(--border-hair)",
      ...style
    }
  }, options.map(o => {
    const id = o.value ?? o;
    const selected = id === value;
    return /*#__PURE__*/React.createElement("button", {
      key: id,
      type: "button",
      role: "tab",
      "aria-selected": selected,
      "aria-label": o.label || id,
      onClick: () => onChange && onChange(id),
      style: {
        boxSizing: "border-box",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 26.25,
        height: 26.25,
        margin: selected ? -0.875 : 0,
        borderRadius: "var(--radius-8)",
        border: selected ? "var(--border-hair)" : "0.875px solid transparent",
        background: "var(--surface-card)",
        boxShadow: selected ? "var(--shadow-raised)" : "none",
        color: selected ? "var(--color-ink-700)" : "var(--icon-default)",
        cursor: "pointer",
        transition: "var(--transition-control)"
      }
    }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
      name: o.icon || id,
      size: 10.5
    }));
  }));
}
Object.assign(__ds_scope, { SegmentedControl });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/SegmentedControl.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Tabs.jsx
try { (() => {
function Tabs({
  tabs = [],
  value,
  onChange,
  onAdd,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      boxSizing: "border-box",
      display: "flex",
      alignItems: "flex-start",
      gap: "var(--space-8)",
      height: "var(--tabstrip-h)",
      borderBottom: "var(--border-default)",
      alignSelf: "stretch",
      ...style
    }
  }, tabs.map(t => {
    const id = t.value ?? t;
    const label = t.label ?? t;
    const selected = id === value;
    return /*#__PURE__*/React.createElement("div", {
      key: id,
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-8)"
      }
    }, /*#__PURE__*/React.createElement("button", {
      type: "button",
      onClick: () => onChange && onChange(id),
      style: {
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        gap: "var(--space-8)",
        height: "var(--control-h)",
        padding: "4px 8px",
        borderRadius: "var(--radius-4)",
        border: "none",
        background: selected ? "var(--surface-tab-active)" : "transparent",
        fontFamily: "var(--font-sans)",
        fontSize: "var(--size-12)",
        lineHeight: "var(--leading-24)",
        color: selected ? "var(--text-primary)" : "var(--text-secondary)",
        cursor: "pointer",
        whiteSpace: "nowrap",
        transition: "var(--transition-control)"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        display: "inline-flex",
        color: selected ? "var(--icon-strong)" : "var(--icon-default)"
      }
    }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
      name: t.icon || "table",
      size: 14
    })), /*#__PURE__*/React.createElement("span", null, label)), /*#__PURE__*/React.createElement("div", {
      style: {
        height: 1,
        alignSelf: "stretch",
        background: selected ? "var(--color-black)" : "transparent"
      }
    }));
  }), onAdd ? /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-label": "Add view",
    onClick: onAdd,
    style: {
      boxSizing: "border-box",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      width: 28,
      height: 28,
      borderRadius: "var(--radius-8)",
      border: "var(--border-default)",
      background: "var(--surface-control)",
      color: "var(--icon-default)",
      cursor: "pointer"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "plus",
    size: 14
  })) : null);
}
Object.assign(__ds_scope, { Tabs });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Tabs.jsx", error: String((e && e.message) || e) }); }

// components/surfaces/BoardColumn.jsx
try { (() => {
function BoardColumn({
  stage,
  tone = "blue",
  count = 0,
  children,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      boxSizing: "border-box",
      display: "flex",
      flexDirection: "column",
      flex: "0 0 auto",
      width: "var(--board-column-w)",
      minWidth: "var(--board-column-w)",
      maxWidth: "var(--board-column-w)",
      borderRadius: "var(--radius-8)",
      background: "var(--surface-board-column)",
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      boxSizing: "border-box",
      display: "flex",
      alignItems: "center",
      gap: "var(--space-4)",
      height: 36,
      padding: "8px 8px"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Badge, {
    tone: tone
  }, stage), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-sans)",
      fontWeight: "var(--weight-bold)",
      fontSize: "var(--size-12)",
      lineHeight: "var(--leading-18)",
      color: tone === "neutral" ? "var(--text-muted)" : "var(--text-primary)"
    }
  }, count)), /*#__PURE__*/React.createElement("div", {
    style: {
      boxSizing: "border-box",
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-8)",
      padding: "4px 8px 8px",
      flex: 1,
      overflow: "hidden"
    }
  }, children));
}
Object.assign(__ds_scope, { BoardColumn });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/surfaces/BoardColumn.jsx", error: String((e && e.message) || e) }); }

// components/surfaces/Card.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Card({
  children,
  interactive = false,
  padding = 12,
  style,
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", _extends({
    onMouseEnter: () => interactive && setHover(true),
    onMouseLeave: () => interactive && setHover(false),
    style: {
      boxSizing: "border-box",
      display: "flex",
      flexDirection: "column",
      padding,
      borderRadius: "var(--radius-8)",
      border: "var(--border-default)",
      background: "var(--surface-card)",
      boxShadow: hover ? "var(--shadow-raised)" : "none",
      cursor: interactive ? "pointer" : "default",
      transition: "box-shadow var(--duration-base) var(--ease-standard)",
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/surfaces/Card.jsx", error: String((e && e.message) || e) }); }

// components/surfaces/ContactCard.jsx
try { (() => {
function ContactCard({
  name,
  email,
  owner,
  activity,
  activityIcon = "mail-open",
  actions = ["note", "checklist"],
  onOpen,
  style
}) {
  return /*#__PURE__*/React.createElement(__ds_scope.Card, {
    interactive: true,
    onClick: onOpen,
    style: {
      gap: "var(--space-8)",
      width: "100%",
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-sans)",
      fontWeight: "var(--weight-semibold)",
      fontSize: "var(--size-13)",
      lineHeight: "var(--leading-18)",
      color: "var(--text-link)"
    }
  }, name), email ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--space-6)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      color: "var(--icon-brand)"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "mail",
    size: 14
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: "var(--size-12)",
      lineHeight: "var(--leading-18)",
      color: "var(--text-link)",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, email), /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      color: "var(--icon-brand)"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "external-link",
    size: 12
  }))) : null, owner ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--space-6)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      color: "var(--icon-default)"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "user",
    size: 14
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: "var(--size-12)",
      lineHeight: "var(--leading-18)",
      color: "var(--text-secondary)"
    }
  }, owner)) : null, /*#__PURE__*/React.createElement("div", {
    style: {
      height: 1,
      background: "var(--rule-color)",
      margin: "var(--space-4) 0"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--space-8)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--space-4)"
    }
  }, actions.map(a => /*#__PURE__*/React.createElement(__ds_scope.IconButton, {
    key: a,
    icon: a,
    variant: "bare",
    size: 20,
    iconSize: 14,
    label: a
  }))), activity ? /*#__PURE__*/React.createElement("div", {
    style: {
      marginLeft: "auto"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Badge, {
    tone: "orange",
    icon: activityIcon,
    iconAfter: "alert",
    divider: true
  }, activity)) : null));
}
Object.assign(__ds_scope, { ContactCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/surfaces/ContactCard.jsx", error: String((e && e.message) || e) }); }

// ui_kits/pulse-crm/AppBar.jsx
try { (() => {
function AppBar() {
  return /*#__PURE__*/React.createElement("header", {
    style: {
      boxSizing: "border-box",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      height: "var(--appbar-h)",
      padding: "8px 12px",
      border: "var(--border-default)",
      background: "var(--surface-appbar)",
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--space-12)"
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/pulse-lockup.svg",
    alt: "Pulse",
    style: {
      height: 15
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--space-10)"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.SearchInput, {
    iconPosition: "leading",
    placeholder: "Find or Ask",
    width: 258,
    surface: "control"
  }), /*#__PURE__*/React.createElement(__ds_scope.IconButton, {
    icon: "plus",
    iconSize: 10,
    label: "Create new",
    style: {
      background: "var(--surface-control)"
    }
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--space-20)",
      color: "var(--icon-default)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--space-14)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--space-4)"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "sparkle",
    size: 16
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--size-12)",
      lineHeight: "24px",
      color: "var(--text-secondary)"
    }
  }, "Spring")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--space-12)"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "phone",
    size: 14
  }), /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "help",
    size: 14
  }), /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "settings",
    size: 14
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      position: "relative",
      display: "inline-flex"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "bell",
    size: 14
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      left: 7,
      top: 6,
      minWidth: 12,
      height: 12,
      padding: "0 4px",
      boxSizing: "border-box",
      borderRadius: "var(--radius-badge)",
      background: "var(--tone-danger-bg)",
      color: "var(--tone-danger-fg)",
      fontSize: "var(--size-9)",
      lineHeight: "11px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }
  }, "3")))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--space-5)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--size-12)",
      lineHeight: "18px",
      color: "var(--text-secondary)"
    }
  }, "HOF Global "), /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "chevron-down",
    size: 6
  }))));
}
Object.assign(__ds_scope, { AppBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/pulse-crm/AppBar.jsx", error: String((e && e.message) || e) }); }

// ui_kits/pulse-crm/ContactsView.jsx
try { (() => {
const CONTACTS = [{
  id: 1,
  name: "Preet from DesignX",
  email: "preet.singh@designx.community",
  owner: "Mohsin Asghar",
  activity: "2 months ago",
  stage: "Lead"
}, {
  id: 2,
  name: "Sinha from Dehli Ex",
  email: "sinhax@designx.community",
  owner: "Preeti sharma",
  activity: "2 months ago",
  stage: "Lead"
}, {
  id: 3,
  name: "Alex from Tech Innovations",
  email: "alex.johnson@techinnovations.com",
  owner: "Divya K",
  activity: "2 months ago",
  stage: "Lead"
}, {
  id: 4,
  name: "Rhea from Northwind",
  email: "rhea@northwind.io",
  owner: "Mohsin Asghar",
  activity: "11 days ago",
  stage: "Lead"
}];
const STAGES = [{
  name: "Subscriber",
  tone: "blue",
  count: 0
}, {
  name: "Lead",
  tone: "orange",
  count: 28
}, {
  name: "Marketing Qualified Lead",
  tone: "orange",
  count: 0
}, {
  name: "Sales Qualified Lead",
  tone: "magenta",
  count: 0
}, {
  name: "Other",
  tone: "neutral",
  count: 0
}];
function ContactsView() {
  const [view, setView] = React.useState("mine");
  const [layout, setLayout] = React.useState("board");
  return /*#__PURE__*/React.createElement("main", {
    style: {
      boxSizing: "border-box",
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-6)",
      padding: "12px 16px",
      flex: 1,
      minWidth: 0,
      alignSelf: "stretch",
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      height: 28,
      alignSelf: "stretch"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--space-6)",
      color: "var(--icon-default)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: "var(--size-13)",
      lineHeight: "29px",
      color: "var(--text-primary)"
    }
  }, "Contacts"), /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "chevron-down",
    size: 10
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--space-12)"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.IconButton, {
    icon: "more",
    label: "View actions"
  }), /*#__PURE__*/React.createElement(__ds_scope.Button, {
    variant: "primary",
    style: {
      width: 119,
      background: "var(--color-ink-900)",
      borderColor: "var(--color-ink-900)"
    }
  }, "Add contacts"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-12)",
      alignSelf: "stretch"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Tabs, {
    value: view,
    onChange: setView,
    onAdd: () => {},
    tabs: [{
      value: "all",
      label: "All contacts",
      icon: "table"
    }, {
      value: "mine",
      label: "My contacts",
      icon: "table"
    }, {
      value: "unassigned",
      label: "Unassigned contacts",
      icon: "table"
    }]
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      height: 28,
      alignSelf: "stretch"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--space-8)"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.SearchInput, {
    width: 215
  }), /*#__PURE__*/React.createElement(__ds_scope.Button, {
    variant: "primary",
    icon: "filter"
  }, "Filter"), /*#__PURE__*/React.createElement(__ds_scope.Button, {
    variant: "secondary",
    icon: "sort"
  }, "Sort by")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--space-8)"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.SegmentedControl, {
    value: layout,
    onChange: setLayout,
    options: [{
      value: "board",
      icon: "board",
      label: "Board view"
    }, {
      value: "table",
      icon: "table",
      label: "Table view"
    }]
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 1,
      height: 24,
      background: "var(--rule-color)"
    }
  }), /*#__PURE__*/React.createElement(__ds_scope.IconButton, {
    icon: "settings",
    iconSize: 10.5,
    hairline: true,
    label: "View settings"
  }), /*#__PURE__*/React.createElement(__ds_scope.IconButton, {
    icon: "chevron-up",
    iconSize: 10.5,
    hairline: true,
    label: "Collapse header"
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      height: 32,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.FilterDropdown, {
    label: "Company owner"
  }), /*#__PURE__*/React.createElement(__ds_scope.FilterDropdown, {
    label: "Create date"
  }), /*#__PURE__*/React.createElement(__ds_scope.FilterDropdown, {
    label: "Last activity date"
  }), /*#__PURE__*/React.createElement(__ds_scope.FilterDropdown, {
    label: "Lead status"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--space-12)",
      marginLeft: "var(--space-12)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 1,
      height: 32,
      borderLeft: "var(--border-1) solid var(--rule-color-strong)"
    }
  }), /*#__PURE__*/React.createElement(__ds_scope.IconButton, {
    icon: "plus",
    iconSize: 12,
    label: "Add filter",
    style: {
      background: "transparent"
    }
  }), /*#__PURE__*/React.createElement(__ds_scope.IconButton, {
    icon: "pencil",
    iconSize: 12,
    label: "Edit filters",
    style: {
      borderRadius: "var(--radius-9-33)",
      borderWidth: "var(--border-1-167)"
    }
  }), /*#__PURE__*/React.createElement(__ds_scope.FilterDropdown, {
    label: "Advanced Filters",
    icon: "filter",
    style: {
      paddingLeft: 8,
      paddingRight: 8
    }
  }))), layout === "board" ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: "var(--space-20)",
      alignItems: "flex-start",
      flex: 1,
      minHeight: 0,
      alignSelf: "stretch",
      overflowX: "auto",
      paddingBottom: 8
    }
  }, STAGES.map(s => /*#__PURE__*/React.createElement(__ds_scope.BoardColumn, {
    key: s.name,
    stage: s.name,
    tone: s.tone,
    count: s.count,
    font: s.font,
    style: {
      height: "100%"
    }
  }, s.name === "Lead" ? CONTACTS.map(c => /*#__PURE__*/React.createElement(__ds_scope.ContactCard, {
    key: c.id,
    name: c.name,
    email: c.email,
    owner: c.owner,
    activity: c.activity
  })) : null))) : /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minHeight: 0,
      alignSelf: "stretch",
      overflow: "auto",
      paddingTop: 4
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.DataTable, {
    rows: CONTACTS,
    columns: [{
      key: "name",
      label: "Name",
      render: r => /*#__PURE__*/React.createElement("a", {
        href: "#",
        onClick: e => e.preventDefault()
      }, r.name)
    }, {
      key: "email",
      label: "Email",
      render: r => /*#__PURE__*/React.createElement("a", {
        href: "#",
        onClick: e => e.preventDefault()
      }, r.email)
    }, {
      key: "stage",
      label: "Lead status",
      render: r => /*#__PURE__*/React.createElement(__ds_scope.Badge, {
        tone: "orange"
      }, r.stage)
    }, {
      key: "owner",
      label: "Contact owner",
      sortable: true
    }, {
      key: "activity",
      label: "Last activity date",
      align: "right"
    }]
  })));
}
Object.assign(__ds_scope, { CONTACTS, ContactsView });
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/pulse-crm/ContactsView.jsx", error: String((e && e.message) || e) }); }

// ui_kits/pulse-crm/PlaceholderView.jsx
try { (() => {
/* The source file only defines the Contacts view. Rather than invent screens
   for Deals, Tasks, Companies, Segments, Marketing Emails, Prospecting Agent
   or Workflows, the kit shows an honest placeholder. */
function PlaceholderView({
  title
}) {
  return /*#__PURE__*/React.createElement("main", {
    style: {
      boxSizing: "border-box",
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-6)",
      padding: "12px 16px",
      flex: 1,
      alignSelf: "stretch"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: 28,
      display: "flex",
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-sans)",
      fontSize: "var(--size-13)",
      lineHeight: "29px"
    }
  }, title)), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      borderRadius: "var(--radius-8)",
      background: "var(--surface-board-column)",
      fontFamily: "var(--font-sans)",
      fontSize: "var(--size-12)",
      lineHeight: "18px",
      color: "var(--text-secondary)",
      textAlign: "center",
      padding: 24
    }
  }, "Not designed yet \u2014 the source file defines the Contacts view only.", /*#__PURE__*/React.createElement("br", null), "This section is intentionally blank."));
}
Object.assign(__ds_scope, { PlaceholderView });
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/pulse-crm/PlaceholderView.jsx", error: String((e && e.message) || e) }); }

// ui_kits/pulse-crm/Sidebar.jsx
try { (() => {
function Sidebar({
  active,
  onNavigate
}) {
  const go = id => () => onNavigate && onNavigate(id);
  return /*#__PURE__*/React.createElement("nav", {
    style: {
      boxSizing: "border-box",
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-16)",
      width: "var(--sidebar-w)",
      flexShrink: 0,
      padding: "var(--space-12)",
      border: "var(--border-default)",
      background: "var(--surface-sidebar)",
      alignSelf: "stretch"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.NavItem, {
    icon: "home",
    active: active === "home",
    onClick: go("home")
  }, "Home"), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 1,
      background: "var(--rule-color)",
      alignSelf: "stretch"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-6)",
      alignSelf: "stretch"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.NavItem, {
    icon: "contacts",
    active: active === "contacts",
    onClick: go("contacts")
  }, "Contacts"), /*#__PURE__*/React.createElement(__ds_scope.NavItem, {
    icon: "deals",
    active: active === "deals",
    onClick: go("deals")
  }, "Deals"), /*#__PURE__*/React.createElement(__ds_scope.NavItem, {
    icon: "tasks",
    active: active === "tasks",
    onClick: go("tasks")
  }, "Tasks"), /*#__PURE__*/React.createElement(__ds_scope.NavItem, {
    icon: "companies",
    active: active === "companies",
    onClick: go("companies")
  }, "Companies"), /*#__PURE__*/React.createElement(__ds_scope.NavItem, {
    icon: "segments",
    active: active === "segments",
    onClick: go("segments")
  }, "Segments")), /*#__PURE__*/React.createElement(__ds_scope.NavSection, {
    title: "Marketing"
  }, /*#__PURE__*/React.createElement(__ds_scope.NavItem, {
    icon: "marketing-emails",
    active: active === "emails",
    onClick: go("emails")
  }, "Marketing Emails")), /*#__PURE__*/React.createElement(__ds_scope.NavSection, {
    title: "Sales"
  }, /*#__PURE__*/React.createElement(__ds_scope.NavItem, {
    icon: "agent",
    active: active === "agent",
    onClick: go("agent")
  }, "Prospecting Agent"), /*#__PURE__*/React.createElement(__ds_scope.NavItem, {
    icon: "workflows",
    active: active === "workflows",
    onClick: go("workflows")
  }, "Workflows")), /*#__PURE__*/React.createElement("button", {
    type: "button",
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--space-4)",
      padding: 0,
      border: "none",
      background: "transparent",
      fontFamily: "var(--font-sans)",
      fontSize: "var(--size-12)",
      lineHeight: "var(--leading-flat)",
      color: "var(--text-secondary)",
      cursor: "pointer"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "edit-nav",
    size: 12
  }), /*#__PURE__*/React.createElement("span", null, "Edit Nav")));
}
Object.assign(__ds_scope, { Sidebar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/pulse-crm/Sidebar.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Icon = __ds_scope.Icon;

__ds_ns.IconButton = __ds_scope.IconButton;

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.DataTable = __ds_scope.DataTable;

__ds_ns.FilterDropdown = __ds_scope.FilterDropdown;

__ds_ns.SearchInput = __ds_scope.SearchInput;

__ds_ns.Select = __ds_scope.Select;

__ds_ns.TextInput = __ds_scope.TextInput;

__ds_ns.NavItem = __ds_scope.NavItem;

__ds_ns.NavSection = __ds_scope.NavSection;

__ds_ns.SegmentedControl = __ds_scope.SegmentedControl;

__ds_ns.Tabs = __ds_scope.Tabs;

__ds_ns.BoardColumn = __ds_scope.BoardColumn;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.ContactCard = __ds_scope.ContactCard;

__ds_ns.AppBar = __ds_scope.AppBar;

__ds_ns.CONTACTS = __ds_scope.CONTACTS;

__ds_ns.ContactsView = __ds_scope.ContactsView;

__ds_ns.PlaceholderView = __ds_scope.PlaceholderView;

__ds_ns.Sidebar = __ds_scope.Sidebar;

})();
