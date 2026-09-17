import assert from 'node:assert/strict'
import { describe, it } from 'bun:test'
import { taskBody, tasksFor } from '@/runner/mise'
import type { GraphNode } from 'types/run'
import type { MiseLayout } from 'types/runner'

const LAYOUT: MiseLayout = {
  configs: ['mise.toml'],
  taskDirectory: '.mise/tasks',
  existingTasks: ['lint', 'deploy'],
}

const node = (name: string, scope: string): GraphNode => ({
  name,
  scope,
  description: name,
  checks: [],
  deps: [],
})

describe('tasksFor', () => {
  it('writes under a subtree, so a task name cannot collide with theirs', () => {
    const [task] = tasksFor(LAYOUT, [node('lint', '')], '0.1.0')
    assert.equal(task?.path, '.mise/tasks/gspot/lint')
    assert.equal(task?.name, 'gspot:lint')
  })

  it('gives a scoped task its own file', () => {
    const tasks = tasksFor(LAYOUT, [node('lint:sql', 'api'), node('lint:sql', 'web')], '0.1.0')
    assert.deepEqual(tasks.map((task) => task.path), [
      '.mise/tasks/gspot/lint-sql-api',
      '.mise/tasks/gspot/lint-sql-web',
    ])
  })
})

describe('taskBody', () => {
  it('shells out to gspot with the scope, rather than restating the graph', () => {
    assert.match(taskBody(node('check', ''), '0.1.0'), /exec gspot check$/mu)
    assert.match(taskBody(node('lint', 'api'), '0.1.0'), /exec gspot check --scope api$/mu)
  })

  it('carries the description mise reads', () => {
    assert.match(taskBody(node('check', ''), '0.1.0'), /#MISE description="check"/u)
  })
})
