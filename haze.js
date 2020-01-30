var tokenize = require("./tokenizer.js");
var parser = require("./parser.js");
var runtime = require("./runtime.js");
var codegen = require("./codegen.js");

var source_code = process.argv[2] || "";

try {
    codegen(source_code).eval();
} catch (e) {
    try {
        if (typeof e === "object" && e.type) {
            console.log("\u0000Error: " + runtime.to_string().value);
        } else if (typeof e === "object" && e.message) {
            console.log("\u0000Error: " + String(e.message));
        } else if (typeof e === "string") {
            console.log("\u0000Error: " + e);
        } else {
            console.log("\u0000Unknow error");
        }
    } catch (e) {
        console.log("\u0000Unknow error");
    }
}

// process.stdout.write('\u0000');

