import { openDB } from 'idb'
import type { TweetProject } from '../types/project'

const db = () => openDB('inest-tweet-cards', 1, { upgrade(database) { database.createObjectStore('projects') } })
export async function loadProject() { return (await db()).get('projects', 'current') as Promise<TweetProject | undefined> }
export async function saveProject(project: TweetProject) { await (await db()).put('projects', project, 'current') }
export async function clearProject() { await (await db()).delete('projects', 'current') }
