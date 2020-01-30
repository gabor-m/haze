var tokenize = require("./tokenizer.js");
var parser = require("./parser.js");
var runtime = require("./runtime.js");
var codegen = require("./codegen.js");

var source_code = process.argv[2] || "";

codegen(source_code).eval();

// process.stdout.write('\u0000');