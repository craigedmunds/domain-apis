#!/usr/bin/env python3
"""
Platform OAS Generator

Generates platform-enhanced OpenAPI specifications from producer OAS by:
1. Preserving $ref to centrally-versioned fragments
2. Injecting platform features (sparse fieldsets)
3. Adding platform metadata

Usage:
    python generate_platform_oas.py ../producer/vpd-submission-returns-api.yaml

Output:
    ../platform/vpd-submission-returns-api.yaml
"""

import yaml
import sys
import os
import re
from pathlib import Path
from typing import Any, Dict, List
from copy import deepcopy


class PlatformOASGenerator:
    """Generates platform OAS from producer OAS"""

    def __init__(self, producer_oas_path: str):
        self.producer_oas_path = Path(producer_oas_path)
        self.producer_dir = self.producer_oas_path.parent
        self.fragments_dir = self.producer_dir.parent / "fragments"
        self.output_dir = self.producer_dir.parent / "platform"
        self.output_dir.mkdir(parents=True, exist_ok=True)

        # Cache for resolved fragments
        self.fragment_cache: Dict[str, Any] = {}

        # Store the root document for internal refs
        self.root_document: Dict[str, Any] = {}

    def load_yaml(self, path: Path) -> Dict[str, Any]:
        """Load YAML file"""
        with open(path, 'r') as f:
            return yaml.safe_load(f)

    def save_yaml(self, data: Dict[str, Any], path: Path):
        """Save YAML file with nice formatting"""
        with open(path, 'w') as f:
            yaml.dump(
                data,
                f,
                default_flow_style=False,
                sort_keys=False,
                allow_unicode=True,
                width=100
            )

    def resolve_ref(self, ref: str, base_path: Path) -> Any:
        """Resolve a $ref to its actual content"""
        if ref in self.fragment_cache:
            return deepcopy(self.fragment_cache[ref])

        # Handle internal refs (starting with #)
        if ref.startswith('#'):
            # Internal reference to root document
            json_pointer = ref[1:]  # Remove leading #
            data = self.root_document

            # Navigate JSON pointer (e.g., /components/schemas/SubmissionRequest)
            if json_pointer:
                pointer_parts = [p for p in json_pointer.split('/') if p]
                for part in pointer_parts:
                    data = data[part]

            return deepcopy(data)

        # Parse external ref: '../fragments/headers.yaml#/X-Correlation-Id-Response'
        parts = ref.split('#')
        file_path = parts[0]
        json_pointer = parts[1] if len(parts) > 1 else ''

        # Resolve file path relative to base
        resolved_path = (base_path / file_path).resolve()

        if not resolved_path.exists():
            raise FileNotFoundError(f"Referenced file not found: {resolved_path}")

        # Load the file
        data = self.load_yaml(resolved_path)

        # Navigate JSON pointer (e.g., /X-Correlation-Id-Response)
        if json_pointer:
            pointer_parts = [p for p in json_pointer.split('/') if p]
            for part in pointer_parts:
                data = data[part]

        # Cache it
        self.fragment_cache[ref] = deepcopy(data)

        return data

    def resolve_refs_recursive(self, obj: Any, base_path: Path) -> Any:
        """Recursively process object - preserve all $ref (fragments are centrally versioned)"""
        if isinstance(obj, dict):
            # Preserve ALL $ref - both internal and external (to fragments)
            # Recursively process all values
            return {k: self.resolve_refs_recursive(v, base_path) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [self.resolve_refs_recursive(item, base_path) for item in obj]
        else:
            return obj

    def resolve_internal_ref(self, ref: str, document: Dict[str, Any]) -> Dict[str, Any]:
        """Resolve an internal $ref within a document"""
        if not ref.startswith('#'):
            return {}

        json_pointer = ref[1:]  # Remove leading #
        data = document

        # Navigate JSON pointer (e.g., /components/schemas/EnrichedSubmission)
        if json_pointer:
            pointer_parts = [p for p in json_pointer.split('/') if p]
            for part in pointer_parts:
                if isinstance(data, dict) and part in data:
                    data = data[part]
                else:
                    return {}

        return data

    def extract_schema_fields(self, schema: Dict[str, Any], document: Dict[str, Any] = None) -> List[str]:
        """Extract field names from a schema"""
        fields = []

        # Handle $ref (internal refs)
        if '$ref' in schema and document:
            resolved_schema = self.resolve_internal_ref(schema['$ref'], document)
            return self.extract_schema_fields(resolved_schema, document)

        # Handle allOf
        if 'allOf' in schema:
            for sub_schema in schema['allOf']:
                fields.extend(self.extract_schema_fields(sub_schema, document))

        # Handle properties
        if 'properties' in schema:
            fields.extend(schema['properties'].keys())

        return list(set(fields))  # Deduplicate

    def inject_sparse_fieldsets(self, path_item: Dict[str, Any], resource_name: str, document: Dict[str, Any]) -> Dict[str, Any]:
        """Inject sparse fieldsets parameter into GET operations"""
        if 'get' not in path_item:
            return path_item

        get_op = path_item['get']

        # Extract fields from response schema
        response_schema = None
        if '200' in get_op.get('responses', {}):
            response = get_op['responses']['200']
            if 'content' in response and 'application/json' in response['content']:
                response_schema = response['content']['application/json'].get('schema', {})

        if not response_schema:
            return path_item

        # Extract field names
        fields = self.extract_schema_fields(response_schema, document)

        if not fields:
            return path_item

        # Create sparse fieldsets parameter
        sparse_fieldsets_param = {
            'name': 'fields',
            'in': 'query',
            'description': (
                f'**Platform-provided sparse fieldsets.** Request specific fields from the response.\n\n'
                f'Format: `fields[:{resource_name}]=field1,field2,field3`\n\n'
                f'Multiple fields are comma-separated. Invalid field names return 400.\n\n'
                f'**Available fields**: {", ".join(sorted(fields))}'
            ),
            'required': False,
            'schema': {
                'type': 'string',
                'pattern': f'^fields\\[:{resource_name}\\]=([\\w]+,?)+$'
            },
            'examples': {
                'singleField': {
                    'summary': 'Request single field',
                    'value': f'fields[:{resource_name}]={fields[0]}' if fields else f'fields[:{resource_name}]=id'
                },
                'multipleFields': {
                    'summary': 'Request multiple fields',
                    'value': f'fields[:{resource_name}]={",".join(fields[:3])}' if len(fields) >= 3 else f'fields[:{resource_name}]=id,name'
                }
            }
        }

        # Add parameter to GET operation
        if 'parameters' not in get_op:
            get_op['parameters'] = []

        get_op['parameters'].append(sparse_fieldsets_param)

        # Add note to description
        if 'description' in get_op:
            get_op['description'] += (
                '\n\n**Platform Feature**: Sparse fieldsets automatically supported. '
                'See `fields` parameter below.'
            )

        return path_item

    def generate(self) -> Path:
        """Generate platform OAS"""
        print(f"Loading producer OAS: {self.producer_oas_path}")
        producer_oas = self.load_yaml(self.producer_oas_path)

        # Store root document for internal refs (used by sparse fieldsets extraction)
        self.root_document = producer_oas

        print("Processing OAS structure (preserving fragment $ref)...")
        # Deep copy preserving all $ref
        platform_oas = self.resolve_refs_recursive(producer_oas, self.producer_dir)

        print("Injecting sparse fieldsets for GET operations...")
        # Inject sparse fieldsets for each path
        for path, path_item in platform_oas.get('paths', {}).items():
            # Determine resource name from path (e.g., /duty/vpd/submission-returns/v1 -> submission)
            resource_name = 'submission'  # Default
            if 'returns' in path.lower():
                resource_name = 'submission'
            elif 'declaration' in path.lower():
                resource_name = 'declaration'

            platform_oas['paths'][path] = self.inject_sparse_fieldsets(path_item, resource_name, platform_oas)

        # Add platform metadata
        platform_oas['info']['x-platform-generated'] = True
        platform_oas['info']['x-platform-features'] = {
            'sparseFieldsets': True,
            'rateLimiting': True,
            'correlationId': True
        }
        platform_oas['info']['description'] = (
            platform_oas['info'].get('description', '') +
            '\n\n---\n\n'
            '**Platform-Enhanced OAS**: This specification includes platform features automatically '
            'injected for all HIP APIs (sparse fieldsets, rate limiting, correlation IDs).'
        )

        # Save output
        output_path = self.output_dir / self.producer_oas_path.name
        print(f"Saving platform OAS: {output_path}")
        self.save_yaml(platform_oas, output_path)

        print("\n✅ Platform OAS generated successfully!")
        print(f"   Producer OAS: {self.producer_oas_path}")
        print(f"   Platform OAS: {output_path}")

        return output_path


def main():
    if len(sys.argv) != 2:
        print("Usage: python generate_platform_oas.py <producer-oas-path>")
        print("\nExample:")
        print("  python generate_platform_oas.py ../producer/vpd-submission-returns-api.yaml")
        sys.exit(1)

    producer_oas_path = sys.argv[1]

    if not os.path.exists(producer_oas_path):
        print(f"Error: File not found: {producer_oas_path}")
        sys.exit(1)

    generator = PlatformOASGenerator(producer_oas_path)
    generator.generate()


if __name__ == '__main__':
    main()
