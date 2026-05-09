/**
 * Create an IAM role for EventBridge Scheduler to invoke a Lambda function.
 * Eliminates the repeated scheduler role pattern across agents.
 */
export function createSchedulerRole(name: string, targetArn: $util.Input<string>): aws.iam.Role {
  const role = new aws.iam.Role(`${name}SchedulerRole`, {
    assumeRolePolicy: JSON.stringify({
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'sts:AssumeRole',
          Effect: 'Allow',
          Principal: { Service: 'scheduler.amazonaws.com' },
        },
      ],
    }),
  });

  new aws.iam.RolePolicy(`${name}SchedulerPolicy`, {
    role: role.name,
    policy: $util.jsonStringify({
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'lambda:InvokeFunction',
          Effect: 'Allow',
          Resource: [targetArn],
        },
      ],
    }),
  });

  return role;
}

/**
 * Create an EventBridge Scheduler schedule that invokes a Lambda function.
 * Combines schedule, role, and permission creation into one call.
 */
export function createScheduledInvocation(
  name: string,
  rate: string,
  targetFn: sst.aws.Function,
  description?: string,
  input?: Record<string, unknown>
): void {
  new aws.scheduler.Schedule(`${name}Schedule`, {
    name: `${$app.name}-${$app.stage}-${name}`,
    ...(description ? { description } : {}),
    scheduleExpression: rate,
    state: 'ENABLED',
    flexibleTimeWindow: { mode: 'OFF' },
    target: {
      arn: targetFn.arn,
      roleArn: createSchedulerRole(name, targetFn.arn).arn,
      ...(input ? { input: JSON.stringify(input) } : {}),
    },
  });

  new aws.lambda.Permission(`${name}Permission`, {
    action: 'lambda:InvokeFunction',
    function: targetFn.name,
    principal: 'scheduler.amazonaws.com',
  });
}
