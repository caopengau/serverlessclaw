/**
 * Fallback type definitions for SST infrastructure globals.
 */

declare namespace sst {
  export const aws: any;
  export const cloudflare: any;

  export namespace aws {
    export type Bus = any;
    export type Queue = any;
    export type Function = any;
    export type Dynamo = any;
    export type Bucket = any;
    export type ApiGatewayV2 = any;
    export type Realtime = any;
    export type Nextjs = any;
    export type SnsTopic = any;
  }
  export namespace cloudflare {
    export type dns = any;
  }
  export type Secret = any;
  export type Linkable<T = any> = any;
}

declare namespace aws {
  export const iam: any;
  export const s3: any;
  export const lambda: any;
  export const codebuild: any;
  export const sns: any;
  export const budgets: any;

  export namespace iam {
    export type Role = any;
    export type Policy = any;
    export type RolePolicyAttachment = any;
  }
  export namespace s3 {
    export type Bucket = any;
  }
  export namespace lambda {
    export type Function = any;
    export type Permission = any;
  }
  export namespace codebuild {
    export type Project = any;
  }
  export namespace sns {
    export type Topic = any;
    export type TopicPolicy = any;
  }
  export namespace budgets {
    export type Budget = any;
  }
}

declare const sst: any;
declare const aws: any;
declare const $app: any;
declare const $dev: any;
declare const $util: any;
declare const $config: any;
