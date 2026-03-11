import { Resource } from 'sst';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { PROTECTED_FILES } from '../core/lib/constants';
import { SSTResource } from '../core/lib/types/index';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

// Extract ConfigTable from Resource
const typedResource = Resource as unknown as SSTResource;
const configTableName = typedResource.ConfigTable.name;

const SEED_DATA = [
  {
    key: 'protected_resources',
    value: PROTECTED_FILES,
  },
  {
    key: 'max_tool_iterations',
    value: 5,
  },
  {
    key: 'reasoning_profiles',
    value: {
      STANDARD: 'claude-3-5-sonnet-latest',
      FAST: 'gpt-4o-mini',
      DEEP: 'claude-3-7-sonnet-latest',
      THINKING: 'claude-3-7-sonnet-latest',
    },
  },
  {
    key: 'evolution_mode',
    value: 'hitl',
  },
  {
    key: 'reflection_frequency',
    value: 3,
  },
  {
    key: 'strategic_review_frequency',
    value: 12,
  },
  {
    key: 'min_gaps_for_review',
    value: 3,
  },
];

async function seed() {
  console.log(`Seeding ConfigTable: ${configTableName}`);

  for (const item of SEED_DATA) {
    try {
      await docClient.send(
        new PutCommand({
          TableName: configTableName,
          Item: item,
        })
      );
      console.log(`✅ Seeded ${item.key}`);
    } catch (e) {
      console.error(`❌ Failed to seed ${item.key}:`, e);
    }
  }
}

seed().catch(console.error);
