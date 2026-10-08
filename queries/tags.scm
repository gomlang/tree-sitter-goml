(function_item name: (identifier) @name) @definition.function
(function_signature_item name: (identifier) @name) @definition.function
(extern_function_item name: (identifier) @name) @definition.function
(struct_item name: (type_identifier) @name) @definition.class
(enum_item name: (type_identifier) @name) @definition.class
(trait_item name: (type_identifier) @name) @definition.interface
(type_item name: (type_identifier) @name) @definition.type
(extern_type_item name: (type_identifier) @name) @definition.type
(const_item name: (identifier) @name) @definition.constant
(static_item name: (identifier) @name) @definition.constant
(call_expression function: (identifier) @name) @reference.call
(call_expression function: (scoped_identifier name: (identifier) @name)) @reference.call
(call_expression function: (scoped_generic_identifier name: (identifier) @name)) @reference.call
(call_expression function: (field_expression field: (identifier) @name)) @reference.call
(generic_function function: (identifier) @name) @reference.call
(generic_function function: (scoped_identifier name: (identifier) @name)) @reference.call
(generic_function function: (scoped_generic_identifier name: (identifier) @name)) @reference.call
(generic_function function: (field_expression field: (identifier) @name)) @reference.call
