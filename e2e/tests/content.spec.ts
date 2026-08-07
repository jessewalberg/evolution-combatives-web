import { test, expect } from '@playwright/test'
import { randomUUID } from 'crypto'
import { contentApi } from '../helpers/api'
import { uniqueSlug, uniqueTitle } from '../helpers/unique'

test.describe('Content - disciplines CRUD', () => {
  const created: { disciplineIds: string[] } = { disciplineIds: [] }

  test.afterEach(async ({ request }) => {
    const api = await contentApi(request)
    const failures: string[] = []
    for (const id of [...created.disciplineIds].reverse()) {
      const result = await api.deleteDiscipline(id)
      if (!result.ok) {
        failures.push(`discipline ${id}: HTTP ${result.status}`)
      }
    }
    if (failures.length) {
      throw new Error(`Discipline teardown failed: ${failures.join('; ')}`)
    }
    created.disciplineIds = []
  })

  test('create via API, assert visible on disciplines page, teardown via DELETE', async ({
    page,
    request,
  }) => {
    const api = await contentApi(request)
    const name = uniqueTitle('Discipline')
    const slug = uniqueSlug('discipline')

    const discipline = await api.createDiscipline({
      name,
      slug,
      description: 'E2E fixture discipline',
    })
    created.disciplineIds.push(discipline.id)

    const list = await api.listDisciplines()
    expect(list.ok).toBeTruthy()
    const rows = (list.body.data as Array<{ id: string; name: string }>) || []
    expect(rows.some((d) => d.id === discipline.id && d.name === name)).toBeTruthy()

    await page.goto('/dashboard/content/disciplines')
    await expect(page.getByText(name).first()).toBeVisible({ timeout: 20_000 })
  })
})

test.describe('Content - categories merge / reorder', () => {
  const created = {
    disciplineId: '' as string,
    categoryIds: [] as string[],
  }

  test.afterEach(async ({ request }) => {
    const api = await contentApi(request)
    const failures: string[] = []
    for (const id of [...created.categoryIds].reverse()) {
      const result = await api.deleteCategory(id)
      if (!result.ok) {
        failures.push(`category ${id}: HTTP ${result.status}`)
      }
    }
    if (created.disciplineId) {
      const result = await api.deleteDiscipline(created.disciplineId)
      if (!result.ok) {
        failures.push(`discipline ${created.disciplineId}: HTTP ${result.status}`)
      }
    }
    if (failures.length) {
      throw new Error(`Category teardown failed: ${failures.join('; ')}`)
    }
    created.categoryIds = []
    created.disciplineId = ''
  })

  test('create categories, reorder, merge source into target, verify via GET', async ({
    request,
  }) => {
    const api = await contentApi(request)

    const discipline = await api.createDiscipline({
      name: uniqueTitle('CatDisc'),
      slug: uniqueSlug('cat-disc'),
    })
    created.disciplineId = discipline.id

    const target = await api.createCategory({
      name: uniqueTitle('TargetCat'),
      slug: uniqueSlug('target-cat'),
      discipline_id: discipline.id,
    })
    const source = await api.createCategory({
      name: uniqueTitle('SourceCat'),
      slug: uniqueSlug('source-cat'),
      discipline_id: discipline.id,
    })
    created.categoryIds.push(target.id, source.id)

    const reorder = await api.reorderCategories([
      { id: source.id, sort_order: 1 },
      { id: target.id, sort_order: 2 },
    ])
    expect(reorder.ok).toBeTruthy()
    expect(reorder.body.success).toBe(true)

    const merge = await api.mergeCategories(target.id, [source.id])
    expect(merge.ok).toBeTruthy()
    expect(merge.body.success).toBe(true)

    // Source removed by merge - only tear down target + discipline
    created.categoryIds = [target.id]

    const list = await request.get('/api/content/categories')
    expect(list.ok()).toBeTruthy()
    const body = await list.json()
    const cats = (body.data as Array<{ id: string }>) || []
    expect(cats.some((c) => c.id === target.id)).toBeTruthy()
    expect(cats.some((c) => c.id === source.id)).toBeFalsy()
  })
})

test.describe('Content - videos processing / publish / bulk / CSV', () => {
  const created = {
    disciplineId: '' as string,
    categoryId: '' as string,
    videoIds: [] as string[],
  }

  test.afterEach(async ({ request }) => {
    const api = await contentApi(request)
    const failures: string[] = []
    if (created.videoIds.length) {
      const result = await api.bulkDeleteVideos(created.videoIds)
      if (!result.ok) {
        failures.push(`videos [${created.videoIds.join(',')}]: HTTP ${result.status}`)
      }
    }
    if (created.categoryId) {
      const result = await api.deleteCategory(created.categoryId)
      if (!result.ok) {
        failures.push(`category ${created.categoryId}: HTTP ${result.status}`)
      }
    }
    if (created.disciplineId) {
      const result = await api.deleteDiscipline(created.disciplineId)
      if (!result.ok) {
        failures.push(`discipline ${created.disciplineId}: HTTP ${result.status}`)
      }
    }
    if (failures.length) {
      throw new Error(`Video teardown failed: ${failures.join('; ')}`)
    }
    created.videoIds = []
    created.categoryId = ''
    created.disciplineId = ''
  })

  test('create processing video, publish, Archive bulk action, CSV export, bulk delete', async ({
    page,
    request,
  }) => {
    const api = await contentApi(request)

    const discipline = await api.createDiscipline({
      name: uniqueTitle('VidDisc'),
      slug: uniqueSlug('vid-disc'),
    })
    created.disciplineId = discipline.id

    const category = await api.createCategory({
      name: uniqueTitle('VidCat'),
      slug: uniqueSlug('vid-cat'),
      discipline_id: discipline.id,
    })
    created.categoryId = category.id

    const videoId = randomUUID()
    const title = uniqueTitle('Video')
    const video = await api.createVideo({
      id: videoId,
      title,
      slug: uniqueSlug('video'),
      categoryId: category.id,
      status: 'processing',
      isPublished: false,
      description: 'E2E video fixture',
    })
    created.videoIds.push(video.id)
    expect(video.processing_status).toBe('processing')

    const publish = await api.bulkUpdateVideoStatus([video.id], {
      processing_status: 'ready',
      is_published: true,
    })
    expect(publish.ok).toBeTruthy()

    const listed = await api.listVideos(title)
    expect(listed.ok).toBeTruthy()

    // Drive the real Archive UI bulk action. Today the app's Archive handlers
    // set processing_status to 'error' ("closest to archived") - there is no
    // true 'archived' status wired into bulkUpdateVideoStatus. Assert that
    // imperfect representation explicitly rather than inventing a different value.
    await page.goto('/dashboard/content/videos')
    await page.getByPlaceholder(/search videos/i).fill(title)
    await expect(page.getByText(title).first()).toBeVisible({ timeout: 20_000 })

    const videoRow = page.locator('tr', { hasText: title })
    await videoRow.locator('input[type="checkbox"]').check()
    await page.getByRole('button', { name: /^archive$/i }).click()

    await expect
      .poll(
        async () => {
          const afterArchive = await api.listVideos(title)
          if (!afterArchive.ok) return null
          const archivedRows =
            (afterArchive.body.data as Array<{ id: string; processing_status: string }>) ||
            []
          return archivedRows.find((v) => v.id === video.id)?.processing_status ?? null
        },
        { timeout: 20_000 }
      )
      .toBe('error')

    await expect(page.getByRole('button', { name: /^export$/i })).toBeVisible({
      timeout: 20_000,
    })

    const downloadPromise = page.waitForEvent('download', { timeout: 15_000 })
    await page.getByRole('button', { name: /^export$/i }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/\.csv$/i)

    const del = await api.bulkDeleteVideos([video.id])
    expect(del.ok).toBeTruthy()
    created.videoIds = []
  })
})
