const PREC = {
  range: 1,
  or: 2,
  and: 3,
  compare: 4,
  bitOr: 5,
  bitXor: 6,
  bitAnd: 7,
  shift: 8,
  add: 9,
  multiply: 10,
  cast: 11,
  unary: 12,
  call: 13,
  try: 14,
  field: 15,
};

const PRIMITIVE_TYPES = [
  'bool',
  'isize',
  'i8',
  'i16',
  'i32',
  'i64',
  'usize',
  'u8',
  'u16',
  'u32',
  'u64',
  'f32',
  'f64',
  'string',
  'char',
];

const commaSep1 = (rule) => seq(rule, repeat(seq(',', rule)));
const list = (rule) => optional(seq(commaSep1(rule), optional(',')));
const withRest = (rule, rest) =>
  optional(
    choice(
      seq(commaSep1(rule), optional(seq(',', rest)), optional(',')),
      seq(rest, optional(',')),
    ),
  );

module.exports = grammar({
  name: 'goml',

  extras: ($) => [/\s/, $.line_comment],
  word: ($) => $.identifier,
  reserved: {
    global: ($) => [
      'extern',
      'package',
      'use',
      'as',
      'fn',
      'trait',
      'impl',
      'for',
      'enum',
      'struct',
      'type',
      'const',
      'static',
      'where',
      'match',
      'if',
      'else',
      'let',
      'in',
      'return',
      'go',
      'defer',
      'while',
      'loop',
      'break',
      'continue',
      'dyn',
      $.visibility_modifier,
      $.mutable_specifier,
      ...PRIMITIVE_TYPES,
      'true',
      'false',
      $.wildcard_pattern,
    ],
  },
  externals: ($) => [$.raw_string_literal, $.raw_byte_string_literal],
  supertypes: ($) => [$._expression, $._type, $._pattern],

  inline: ($) => [$._identifier, $._type_identifier],

  conflicts: ($) => [
    [$.cast_expression, $.select_guard],
    [$._expression, $._path, $.scope_expression],
    [$._expression, $._path, $.comptime_expression],
    [$._expression, $._path, $.select_expression],
    [$._path, $.scope_expression],
    [$._path, $.comptime_expression],
    [$._path, $.select_expression],
    [$._expression, $._path],
  ],

  rules: {
    source_file: ($) =>
      seq(
        optional($.package_declaration),
        repeat($.use_declaration),
        repeat($._item),
      ),
    package_declaration: ($) =>
      seq('package', field('name', $._identifier), ';'),
    use_declaration: ($) =>
      seq(
        optional($.visibility_modifier),
        'use',
        field('path', $._path),
        optional(
          choice(
            seq('as', field('alias', $._identifier)),
            seq('::', $.use_list),
          ),
        ),
        ';',
      ),
    use_list: ($) => seq('{', list($.use_item), '}'),
    use_item: ($) =>
      seq(
        field('name', $._identifier),
        optional(seq('as', field('alias', $._identifier))),
      ),
    visibility_modifier: (_) => 'pub',

    _item: ($) =>
      choice(
        $.function_item,
        $.struct_item,
        $.enum_item,
        $.trait_item,
        $.impl_item,
        $.type_item,
        $.const_item,
        $.static_item,
        $.extern_function_item,
        $.extern_type_item,
      ),
    attribute: ($) =>
      seq('#', optional('!'), '[', repeat($._attribute_token), ']'),
    _attribute_token: ($) =>
      choice(
        $.token_tree,
        $._literal,
        $._identifier,
        $.primitive_type,
        /[^\s\w\[\](){}"'`]+/,
      ),
    token_tree: ($) =>
      choice(
        seq('(', repeat($._attribute_token), ')'),
        seq('[', repeat($._attribute_token), ']'),
        seq('{', repeat($._attribute_token), '}'),
      ),
    _function_signature: ($) =>
      seq(
        'fn',
        field('name', $._identifier),
        field('type_parameters', optional($.type_parameters)),
        field('parameters', $.parameters),
        optional(seq('->', field('return_type', $._type))),
        optional($.where_clause),
      ),
    function_item: ($) =>
      seq(
        repeat($.attribute),
        optional($.visibility_modifier),
        $._function_signature,
        field('body', $.block),
      ),
    function_signature_item: ($) =>
      seq(repeat($.attribute), $._function_signature, ';'),
    extern_function_item: ($) =>
      seq(
        repeat($.attribute),
        optional($.visibility_modifier),
        'extern',
        $._function_signature,
        ';',
      ),
    extern_type_item: ($) =>
      seq(
        repeat($.attribute),
        optional($.visibility_modifier),
        'extern',
        'type',
        field('name', $._type_identifier),
        optional($.type_parameters),
        ';',
      ),
    parameters: ($) =>
      seq('(', list(choice($.parameter, $.self_parameter)), ')'),
    parameter: ($) =>
      seq(field('name', $._identifier), ':', field('type', $._type)),
    self_parameter: (_) => 'self',
    type_parameters: ($) =>
      seq(
        '[',
        commaSep1(choice($.type_parameter, $.const_parameter)),
        optional(','),
        ']',
      ),
    type_parameter: ($) =>
      seq(
        field('name', $._type_identifier),
        optional(seq(':', $.trait_bounds)),
      ),
    const_parameter: ($) =>
      seq('const', field('name', $._type_identifier), ':', 'usize'),
    trait_bounds: ($) =>
      prec.right(seq($.trait_bound, repeat(seq('+', $.trait_bound)))),
    trait_bound: ($) =>
      prec.right(seq($._type_path, optional($.type_arguments))),
    where_clause: ($) =>
      seq('where', commaSep1($.where_predicate), optional(',')),
    where_predicate: ($) =>
      seq(
        field('left', $._type),
        choice(seq(':', $.trait_bounds), seq('=', field('right', $._type))),
      ),

    struct_item: ($) =>
      seq(
        repeat($.attribute),
        optional($.visibility_modifier),
        'struct',
        field('name', $._type_identifier),
        optional($.type_parameters),
        choice(
          field('body', $.field_declaration_list),
          seq($.ordered_field_declaration_list, ';'),
        ),
      ),
    field_declaration_list: ($) => seq('{', list($.field_declaration), '}'),
    field_declaration: ($) =>
      seq(
        repeat($.attribute),
        optional($.visibility_modifier),
        field('name', $._identifier),
        ':',
        field('type', $._type),
      ),
    ordered_field_declaration_list: ($) =>
      seq(
        '(',
        repeat($.attribute),
        optional($.visibility_modifier),
        field('type', $._type),
        optional(','),
        ')',
      ),
    enum_item: ($) =>
      seq(
        repeat($.attribute),
        optional($.visibility_modifier),
        'enum',
        field('name', $._type_identifier),
        optional($.type_parameters),
        field('body', $.enum_variant_list),
      ),
    enum_variant_list: ($) => seq('{', list($.enum_variant), '}'),
    enum_variant: ($) =>
      seq(
        repeat($.attribute),
        field('name', $._identifier),
        optional(
          choice(
            seq('(', list($.enum_payload_field), ')'),
            $.field_declaration_list,
          ),
        ),
      ),
    enum_payload_field: ($) => seq(repeat($.attribute), field('type', $._type)),
    trait_item: ($) =>
      seq(
        repeat($.attribute),
        optional($.visibility_modifier),
        'trait',
        field('name', $._type_identifier),
        optional($.type_parameters),
        optional(seq(':', $.trait_bounds)),
        optional($.where_clause),
        field('body', $.trait_body),
      ),
    trait_body: ($) =>
      seq(
        '{',
        repeat(
          choice(
            $.function_item,
            $.function_signature_item,
            $.associated_type,
            $.associated_const,
          ),
        ),
        '}',
      ),
    associated_type: ($) =>
      seq(
        'type',
        field('name', $._type_identifier),
        optional(seq(':', $.trait_bounds)),
        ';',
      ),
    associated_const: ($) =>
      seq(
        'const',
        field('name', $._identifier),
        ':',
        field('type', $._type),
        optional(seq('=', field('value', $._expression))),
        ';',
      ),
    impl_item: ($) =>
      seq(
        repeat($.attribute),
        'impl',
        optional($.type_parameters),
        optional(seq(field('trait', $.trait_bound), 'for')),
        field('type', $._type),
        optional($.where_clause),
        field('body', $.impl_body),
      ),
    impl_body: ($) =>
      seq('{', repeat(choice($.function_item, $.type_item, $.const_item)), '}'),
    type_item: ($) =>
      seq(
        repeat($.attribute),
        optional($.visibility_modifier),
        'type',
        field('name', $._type_identifier),
        optional($.type_parameters),
        '=',
        field('type', $._type),
        ';',
      ),
    const_item: ($) =>
      seq(
        repeat($.attribute),
        optional($.visibility_modifier),
        'const',
        field('name', $._identifier),
        ':',
        field('type', $._type),
        '=',
        field('value', $._expression),
        ';',
      ),
    static_item: ($) =>
      seq(
        repeat($.attribute),
        optional($.visibility_modifier),
        'static',
        field('name', $._identifier),
        ':',
        field('type', $._type),
        '=',
        field('value', $._expression),
        ';',
      ),

    _type: ($) =>
      choice(
        $.primitive_type,
        $._type_path,
        $.generic_type,
        $.tuple_type,
        $.array_type,
        $.function_type,
        $.dynamic_type,
        $.opaque_type,
      ),
    primitive_type: (_) => choice(...PRIMITIVE_TYPES),
    _type_identifier: ($) => alias($._identifier, $.type_identifier),
    _type_path: ($) => choice($._type_identifier, $.scoped_type_identifier),
    scoped_type_identifier: ($) =>
      seq(field('path', $._path), '::', field('name', $._type_identifier)),
    generic_type: ($) =>
      prec(
        1,
        seq(
          field('type', $._type_path),
          field('type_arguments', $.type_arguments),
        ),
      ),
    type_arguments: ($) =>
      seq(
        '[',
        commaSep1(
          choice(
            $._type,
            $.integer_literal,
            $.block,
            $.associated_type_binding,
          ),
        ),
        optional(','),
        ']',
      ),
    associated_type_binding: ($) =>
      seq(field('name', $._type_identifier), '=', field('type', $._type)),
    tuple_type: ($) => seq('(', list($._type), ')'),
    array_type: ($) =>
      seq(
        '[',
        field('element', $._type),
        ';',
        field('length', $._expression),
        ']',
      ),
    function_type: ($) =>
      prec.right(
        seq(field('parameters', $._type), '->', field('return_type', $._type)),
      ),
    dynamic_type: ($) => prec.right(seq('dyn', $.trait_bounds)),
    opaque_type: ($) => prec.right(seq('impl', $.trait_bounds)),

    block: ($) =>
      seq(
        '{',
        repeat($._statement),
        field('value', optional($._expression)),
        '}',
      ),
    _statement: ($) =>
      choice(
        $.let_declaration,
        $.assignment_statement,
        $.defer_statement,
        $.expression_statement,
        $.empty_statement,
      ),
    empty_statement: (_) => ';',
    let_declaration: ($) =>
      seq(
        'let',
        optional($.mutable_specifier),
        field('pattern', $._pattern),
        optional(seq(':', field('type', $._type))),
        '=',
        field('value', $._expression),
        optional(seq('else', field('alternative', $.block))),
        ';',
      ),
    mutable_specifier: (_) => 'mut',
    assignment_statement: ($) =>
      seq(
        field('left', $._expression),
        field(
          'operator',
          choice(
            '=',
            '+=',
            '-=',
            '*=',
            '/=',
            '%=',
            '&=',
            '|=',
            '^=',
            '<<=',
            '>>=',
          ),
        ),
        field('right', $._expression),
        ';',
      ),
    defer_statement: ($) => seq('defer', $._expression, ';'),
    expression_statement: ($) =>
      choice(seq($._expression, ';'), prec(-1, $._control_expression)),

    _expression: ($) =>
      choice(
        $._literal,
        $._identifier,
        $.scoped_identifier,
        $.generic_function,
        $.scoped_generic_identifier,
        $.tuple_expression,
        $.parenthesized_expression,
        $.array_expression,
        $.block,
        $.struct_expression,
        $.closure_expression,
        $.call_expression,
        $.field_expression,
        $.index_expression,
        $.unary_expression,
        $.binary_expression,
        $.cast_expression,
        $.range_expression,
        $.try_expression,
        $._control_expression,
        $.labeled_expression,
        $.return_expression,
        $.break_expression,
        $.continue_expression,
        $.go_expression,
        $.scope_expression,
        $.spawn_expression,
        $.comptime_expression,
      ),
    _path: ($) => choice($._identifier, $.scoped_identifier),
    scoped_identifier: ($) =>
      seq(field('path', $._path), '::', field('name', $._identifier)),
    scoped_generic_identifier: ($) =>
      seq(
        field('path', choice($.generic_function, $.scoped_generic_identifier)),
        '::',
        field('name', $._identifier),
      ),
    generic_function: ($) =>
      prec(
        PREC.field,
        seq(
          field(
            'function',
            choice($._path, $.field_expression, $.scoped_generic_identifier),
          ),
          '::',
          field('type_arguments', $.type_arguments),
        ),
      ),
    parenthesized_expression: ($) => seq('(', $._expression, ')'),
    tuple_expression: ($) =>
      seq('(', optional(seq($._expression, ',', list($._expression))), ')'),
    array_expression: ($) =>
      seq(
        '[',
        choice(
          list($._expression),
          seq(
            field('value', $._expression),
            ';',
            field('length', $._expression),
          ),
        ),
        ']',
      ),
    struct_expression: ($) =>
      seq(
        field('name', $._path),
        field('body', $.field_initializer_list),
      ),
    field_initializer_list: ($) =>
      seq(
        '{',
        withRest(
          choice($.field_initializer, $.shorthand_field_initializer),
          $.base_field_initializer,
        ),
        '}',
      ),
    field_initializer: ($) =>
      seq(field('field', $._identifier), ':', field('value', $._expression)),
    shorthand_field_initializer: ($) => $._identifier,
    base_field_initializer: ($) => seq('..', $._expression),
    closure_expression: ($) =>
      prec.right(
        seq(
          field('parameters', $.closure_parameters),
          field('body', $._expression),
        ),
      ),
    closure_parameters: ($) =>
      choice('||', seq('|', list($.closure_parameter), '|')),
    closure_parameter: ($) =>
      seq(
        field('name', choice($._identifier, $.wildcard_pattern)),
        optional(seq(':', field('type', $._type))),
      ),
    call_expression: ($) =>
      prec(
        PREC.call,
        seq(field('function', $._expression), field('arguments', $.arguments)),
      ),
    arguments: ($) => seq('(', list($._expression), ')'),
    field_expression: ($) =>
      prec(
        PREC.field,
        seq(
          field('value', $._expression),
          '.',
          field('field', choice($._identifier, $.integer_literal)),
        ),
      ),
    index_expression: ($) =>
      prec(
        PREC.call,
        seq(
          field('value', $._expression),
          '[',
          field('index', $._expression),
          ']',
        ),
      ),
    unary_expression: ($) =>
      prec(
        PREC.unary,
        seq(
          field('operator', choice('-', '!', '~')),
          field('argument', $._expression),
        ),
      ),
    binary_expression: ($) =>
      choice(
        ...[
          [PREC.or, '||'],
          [PREC.and, '&&'],
          [PREC.compare, choice('==', '!=', '<', '>', '<=', '>=')],
          [PREC.bitOr, '|'],
          [PREC.bitXor, '^'],
          [PREC.bitAnd, '&'],
          [PREC.shift, choice('<<', '>>')],
          [PREC.add, choice('+', '-')],
          [PREC.multiply, choice('*', '/', '%')],
        ].map(([p, op]) =>
          prec.left(
            p,
            seq(
              field('left', $._expression),
              field('operator', op),
              field('right', $._expression),
            ),
          ),
        ),
      ),
    cast_expression: ($) =>
      prec.left(
        PREC.cast,
        seq(field('value', $._expression), 'as', field('type', $.dynamic_type)),
      ),
    range_expression: ($) =>
      prec.left(
        PREC.range,
        seq(
          field('start', $._expression),
          field('operator', choice('..', '..=')),
          field('end', $._expression),
        ),
      ),
    try_expression: ($) => prec(PREC.try, seq($._expression, '?')),
    _control_expression: ($) =>
      choice(
        $.if_expression,
        $.match_expression,
        $.select_expression,
        $.while_expression,
        $.loop_expression,
        $.for_expression,
      ),
    if_expression: ($) =>
      prec.right(
        seq(
          'if',
          field('condition', $._condition),
          field('consequence', $.block),
          optional(
            seq('else', field('alternative', choice($.block, $.if_expression))),
          ),
        ),
      ),
    _condition: ($) => choice($._expression, $.let_condition, $.let_chain),
    let_condition: ($) =>
      prec.left(
        PREC.and + 1,
        seq(
          'let',
          field('pattern', $._pattern),
          '=',
          field('value', $._expression),
        ),
      ),
    let_chain: ($) =>
      prec.left(
        PREC.and,
        choice(
          seq($._expression, '&&', $.let_condition),
          seq(
            choice($.let_condition, $.let_chain),
            '&&',
            choice($._expression, $.let_condition),
          ),
        ),
      ),
    match_expression: ($) =>
      seq('match', field('value', $._expression), field('body', $.match_block)),
    match_block: ($) => seq('{', list($.match_arm), '}'),
    match_arm: ($) =>
      seq(
        field('pattern', $._pattern),
        optional(seq('if', field('condition', $._expression))),
        '=>',
        field('value', $._expression),
      ),
    while_expression: ($) =>
      seq('while', field('condition', $._condition), field('body', $.block)),
    loop_expression: ($) => seq('loop', field('body', $.block)),
    for_expression: ($) =>
      seq(
        'for',
        field('pattern', $._pattern),
        'in',
        field('value', $._expression),
        field('body', $.block),
      ),
    labeled_expression: ($) =>
      seq(
        $.label,
        ':',
        choice($.while_expression, $.loop_expression, $.for_expression),
      ),
    label: (_) => token(seq("'", /[a-z_][A-Za-z_0-9]*/)),
    return_expression: ($) =>
      prec.right(seq('return', optional($._expression))),
    break_expression: ($) =>
      prec.right(seq('break', optional($.label), optional($._expression))),
    continue_expression: ($) => seq('continue', optional($.label)),
    go_expression: ($) => prec.right(seq('go', $._expression)),
    scope_expression: ($) => seq('scope', field('body', $.block)),
    spawn_expression: ($) => prec(1, seq('spawn', $.closure_expression)),
    comptime_expression: ($) => seq('comptime', field('body', $.block)),
    select_expression: ($) =>
      seq(
        'select',
        optional('priority'),
        '{',
        commaSep1($.select_arm),
        optional(','),
        '}',
      ),
    select_arm: ($) =>
      choice(
        seq(
          'recv',
          '(',
          field('channel', $._expression),
          ')',
          optional($.select_guard),
          choice(
            seq(
              'as',
              field('binding', choice($._identifier, $.wildcard_pattern)),
              '=>',
              field('value', $._expression),
            ),
            seq('match', $.match_block),
          ),
        ),
        seq(
          'send',
          '(',
          field('channel', $._expression),
          ',',
          field('value', $._expression),
          ')',
          optional($.select_guard),
          '=>',
          field('body', $._expression),
        ),
        seq('default', '=>', field('body', $._expression)),
      ),
    select_guard: ($) => prec(PREC.cast, seq('when', $._expression)),

    _pattern: ($) =>
      choice(
        $._primary_pattern,
        $.or_pattern,
        $.alias_pattern,
        $.range_pattern,
      ),
    _primary_pattern: ($) =>
      choice(
        $._identifier,
        $.scoped_identifier,
        $.wildcard_pattern,
        $.mutable_pattern,
        $.boolean_literal,
        $.integer_literal,
        $.float_literal,
        $.negative_literal,
        $.char_literal,
        $.byte_literal,
        $.string_literal,
        $.raw_string_literal,
        $.tuple_pattern,
        $.parenthesized_pattern,
        $.tuple_struct_pattern,
        $.struct_pattern,
        $.slice_pattern,
      ),
    wildcard_pattern: (_) => '_',
    mutable_pattern: ($) => prec(-1, seq($.mutable_specifier, $._identifier)),
    negative_literal: ($) =>
      seq('-', choice($.integer_literal, $.float_literal)),
    tuple_pattern: ($) =>
      seq('(', optional(seq($._pattern, ',', list($._pattern))), ')'),
    parenthesized_pattern: ($) => seq('(', $._pattern, ')'),
    tuple_struct_pattern: ($) =>
      seq(field('type', $._path), '(', list($._pattern), ')'),
    struct_pattern: ($) =>
      seq(
        field('type', $._path),
        '{',
        withRest($.field_pattern, $.remaining_field_pattern),
        '}',
      ),
    field_pattern: ($) =>
      seq(
        field('name', $._identifier),
        optional(seq(':', field('pattern', $._pattern))),
      ),
    remaining_field_pattern: (_) => '..',
    slice_pattern: ($) =>
      seq(
        '[',
        choice(
          list($._pattern),
          seq(
            optional(seq(commaSep1($._pattern), ',')),
            $.rest_pattern,
            repeat(seq(',', $._pattern)),
            optional(','),
          ),
        ),
        ']',
      ),
    rest_pattern: ($) => seq(optional(seq($._identifier, '@')), '..'),
    or_pattern: ($) =>
      prec.left(
        1,
        seq(
          choice(
            $._primary_pattern,
            $.range_pattern,
            $.alias_pattern,
            $.or_pattern,
          ),
          '|',
          choice($._primary_pattern, $.range_pattern, $.alias_pattern),
        ),
      ),
    alias_pattern: ($) =>
      prec.right(
        2,
        seq(
          $._identifier,
          '@',
          choice($._primary_pattern, $.range_pattern, $.alias_pattern),
        ),
      ),
    range_pattern: ($) =>
      prec(
        3,
        seq(
          $._primary_pattern,
          choice('..', '..='),
          choice(
            $.integer_literal,
            $.negative_literal,
            $.char_literal,
            $.byte_literal,
          ),
        ),
      ),

    _identifier: ($) =>
      choice(
        $.identifier,
        alias(
          choice(
            'select',
            'priority',
            'recv',
            'send',
            'default',
            'when',
            'scope',
            'spawn',
            'comptime',
            'self',
          ),
          $.identifier,
        ),
      ),
    identifier: (_) => /[A-Za-z][A-Za-z_0-9]*|_[A-Za-z_0-9]+/,
    line_comment: (_) => token(seq('//', /[^\r\n]*/)),
    _literal: ($) =>
      choice(
        $.integer_literal,
        $.float_literal,
        $.boolean_literal,
        $.char_literal,
        $.byte_literal,
        $.string_literal,
        $.byte_string_literal,
        $.raw_string_literal,
        $.raw_byte_string_literal,
        $.multiline_string_literal,
        $.interpolated_string_expression,
      ),
    integer_literal: (_) =>
      token(
        choice(
          /0[bB][01](_?[01])*/,
          /0[oO][0-7](_?[0-7])*/,
          /0[xX][0-9a-fA-F](_?[0-9a-fA-F])*/,
          /[0-9](_?[0-9])*/,
        ),
      ),
    float_literal: (_) =>
      token(
        choice(
          /[0-9](_?[0-9])*\.[0-9](_?[0-9])*([eE][+-]?[0-9](_?[0-9])*)?/,
          /[0-9](_?[0-9])*[eE][+-]?[0-9](_?[0-9])*/,
        ),
      ),
    boolean_literal: (_) => choice('true', 'false'),
    char_literal: (_) =>
      token(
        seq("'", choice(/[^'\\\r\n]/, /\\(["'\\nrtbf/]|u[0-9a-fA-F]{4})/), "'"),
      ),
    byte_literal: (_) =>
      token(
        seq(
          "b'",
          choice(
            /[\x20-\x26\x28-\x5b\x5d-\x7e]/,
            /\\(['\\0bfnrt]|x[0-9a-fA-F]{2})/,
          ),
          "'",
        ),
      ),
    string_literal: ($) =>
      seq(
        '"',
        repeat(choice($.string_content, $.escape_sequence)),
        token.immediate('"'),
      ),
    string_content: (_) => token.immediate(prec(1, /[^"\\\r\n]+/)),
    escape_sequence: (_) => token.immediate(/\\(["\\nrtbf/]|u[0-9a-fA-F]{4})/),
    byte_string_literal: ($) =>
      seq(
        'b"',
        repeat(choice($.byte_string_content, $.byte_escape_sequence)),
        token.immediate('"'),
      ),
    byte_string_content: (_) =>
      token.immediate(prec(1, /[\x20-\x21\x23-\x5b\x5d-\x7e]+/)),
    byte_escape_sequence: (_) =>
      token.immediate(/\\(["\\0bfnrt/]|x[0-9a-fA-F]{2})/),
    multiline_string_literal: (_) =>
      token(/\\\\[^\n]*\n[ \t]*\\\\[^\n]*(\n[ \t]*\\\\[^\n]*)*/),
    interpolated_string_expression: ($) =>
      seq(
        'f"',
        repeat(
          choice(
            $.interpolation_content,
            $.escape_sequence,
            $.escaped_brace,
            $.interpolation,
          ),
        ),
        token.immediate('"'),
      ),
    interpolation_content: (_) => token.immediate(prec(1, /[^"\\{}\r\n]+/)),
    escaped_brace: (_) => token.immediate(choice('{{', '}}')),
    interpolation: ($) => seq(token.immediate('{'), $._expression, '}'),
  },
});
