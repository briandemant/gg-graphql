"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function phone(id) {
    const n = id * 2909;
    return ((id % 5) ? "99 " : "+55 99 ") + [6, 7, 8]
        .map((x, i) => `${(n + i) % x + 1}${(n + i * 13) % (x - i)}`)
        .join(" ");
}
function title(id) {
    return `Title #${id}`;
}
function username(id) {
    return `Username #${id}`;
}
exports.default = { phone, title, username };
//# sourceMappingURL=fake.js.map