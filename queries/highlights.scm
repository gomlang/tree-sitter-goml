(identifier) @variable
(type_identifier) @type
(primitive_type) @type.builtin
(self_parameter) @variable.builtin
((identifier) @variable.builtin (#eq? @variable.builtin "self"))
((type_identifier) @type.builtin (#match? @type.builtin "^(Self|never)$"))

(function_item name: (identifier) @function)
(function_signature_item name: (identifier) @function)
(extern_function_item name: (identifier) @function)
(call_expression function: (identifier) @function)
(call_expression function: (scoped_identifier name: (identifier) @function))
(call_expression function: (scoped_generic_identifier name: (identifier) @function))
(generic_function function: (identifier) @function)
(generic_function function: (scoped_identifier name: (identifier) @function))
(generic_function function: (scoped_generic_identifier name: (identifier) @function))
(field_expression field: (identifier) @property)
(call_expression function: (field_expression field: (identifier) @function))
(generic_function function: (field_expression field: (identifier) @function))

(parameter name: (identifier) @variable.parameter)
(closure_parameter name: (identifier) @variable.parameter)
(field_declaration name: (identifier) @property)
(field_initializer field: (identifier) @property)
(shorthand_field_initializer (identifier) @property)
(field_pattern name: (identifier) @property)
(enum_variant name: (identifier) @constant)
(const_item name: (identifier) @constant)
(associated_const name: (identifier) @constant)
(static_item name: (identifier) @variable)
(struct_expression name: (identifier) @type)
(struct_expression name: (scoped_identifier name: (identifier) @type))
(tuple_struct_pattern type: (identifier) @constructor)
(struct_pattern type: (identifier) @constructor)
(package_declaration name: (identifier) @module)
(use_declaration path: (identifier) @module)
(scoped_identifier path: (identifier) @module)
(scoped_type_identifier path: (identifier) @module)
(label) @string.special
(attribute) @attribute
(line_comment) @comment
((line_comment) @comment.documentation (#match? @comment.documentation "^//(/([^/]|$)|!)"))

[(integer_literal) (byte_literal)] @number
(float_literal) @number
(boolean_literal) @boolean
(char_literal) @string.special
[(string_literal) (raw_string_literal) (byte_string_literal)
 (raw_byte_string_literal) (multiline_string_literal) (interpolated_string_expression)] @string
[(escape_sequence) (byte_escape_sequence) (escaped_brace)] @string.escape
(interpolation ["{" "}"] @punctuation.special)

["package" "use" "as" "fn" "struct" "enum" "trait" "impl" "type"
 "const" "static" "where" "extern" "dyn" "let" "defer" "go"] @keyword
["if" "else" "match"] @keyword
["while" "loop" "for" "in" "break" "continue"] @keyword
"return" @keyword
(select_expression ["select" "priority"] @keyword)
(select_arm ["recv" "send" "default" "match" "as"] @keyword)
(select_guard "when" @keyword)
(scope_expression "scope" @keyword)
(spawn_expression "spawn" @keyword)
(comptime_expression "comptime" @keyword)

["+" "-" "*" "/" "%" "!" "~" "&" "|" "^" "&&" "||" "<<" ">>"
 "==" "!=" "<" ">" "<=" ">=" "=" "+=" "-=" "*=" "/=" "%=" "&=" "|=" "^="
 "<<=" ">>=" "?" ".." "..=" "@" "->" "=>"] @operator
["(" ")" "[" "]" "{" "}"] @punctuation.bracket
["," ";" ":" "::" "."] @punctuation.delimiter
(wildcard_pattern) @variable.builtin

[(visibility_modifier) (mutable_specifier)] @keyword
