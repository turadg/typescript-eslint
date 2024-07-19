import type { TSESTree } from '@typescript-eslint/utils';
import { ESLintUtils } from '@typescript-eslint/utils';
import * as ts from 'typescript';

import { createRule, nullThrows, NullThrowsReasons } from '../util';

type Options = [{ [exportName: string]: string }];
type MessageIds = 'invalidExportType' | 'unresolvedType';

const capitalize = <T extends string>(s: T) =>
  (s.charAt(0).toUpperCase() + s.slice(1)) as Capitalize<T>;

export default createRule<Options, MessageIds>({
  name: 'exports-satisfy',
  meta: {
    type: 'problem',
    docs: {
      description: 'Ensure all exports satisfy certain types',
    },
    schema: [
      {
        type: 'object',
        additionalProperties: {
          type: 'string',
        },
      },
    ],
    messages: {
      invalidExportType:
        'Exported member "{{ exportName }}" does not satisfy the type "{{ typeName }}"',
      unresolvedType: 'The type "{{ typeName }}" could not be resolved',
    },
  },
  defaultOptions: [{}],
  create(context, [typeMap]) {
    const parserServices = ESLintUtils.getParserServices(context);
    const checker = parserServices.program.getTypeChecker();

    function getExpectedType(
      program: ts.Program,
      typeName: string,
    ): ts.Type | null {
      // Handle built types
      if (
        typeName === 'number' ||
        typeName === 'string' ||
        typeName === 'boolean'
      ) {
        const kindName = capitalize(`${typeName}Keyword`);
        return checker.getTypeFromTypeNode(
          ts.factory.createKeywordTypeNode(ts.SyntaxKind[kindName]),
        );
      }

      // Handle user-defined types
      const sourceFiles = program.getSourceFiles();
      for (const sourceFile of sourceFiles) {
        const typeNode = sourceFile.statements.find(statement => {
          if (
            ts.isTypeAliasDeclaration(statement) ||
            ts.isInterfaceDeclaration(statement)
          ) {
            return statement.name.text === typeName;
          }
          return false;
        });
        if (typeNode) {
          return checker.getTypeAtLocation(typeNode);
        }
      }
      return null;
    }

    function checkNode(
      node: TSESTree.Node,
      tsNode: ts.Node,
      exportName: string,
    ) {
      const typeName = typeMap[exportName] || typeMap['*'];
      // No constraint specified
      if (!typeName) return;

      const expectedType = getExpectedType(parserServices.program, typeName);
      if (!expectedType) {
        context.report({
          node,
          messageId: 'unresolvedType',
          data: { typeName },
        });
        return;
      }

      const type = checker.getTypeAtLocation(tsNode);
      if ('intrinsicName' in type && type.intrinsicName === 'error') {
        context.report({
          node,
          messageId: 'unresolvedType',
          data: { typeName: type.aliasSymbol?.escapedName ?? '<error>' },
        });
      } else {
        if (!checker.isTypeAssignableTo(type, expectedType)) {
          context.report({
            node,
            messageId: 'invalidExportType',
            data: { exportName, typeName },
          });
        }
      }
    }

    return {
      ExportNamedDeclaration(node: TSESTree.ExportNamedDeclaration) {
        const tsNode = parserServices.esTreeNodeToTSNodeMap.get(node);
        if (node.declaration && tsNode) {
          if (ts.isVariableStatement(tsNode)) {
            tsNode.declarationList.declarations.forEach(declNode => {
              if (ts.isIdentifier(declNode.name)) {
                checkNode(node, declNode, declNode.name.text);
              }
            });
          } else if (ts.isFunctionDeclaration(tsNode) && tsNode.name) {
            checkNode(node, tsNode, tsNode.name.text);
          } else if (ts.isClassDeclaration(tsNode) && tsNode.name) {
            checkNode(node, tsNode, tsNode.name.text);
          }
        }
      },
    };
  },
});
