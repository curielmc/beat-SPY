import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '../lib/supabase'

export const useTrainingStore = defineStore('training', () => {
  const tutorials = ref([])
  const currentTutorial = ref(null)
  const currentStep = ref(null)
  const progress = ref({})
  const loading = ref(false)
  const classTutorials = ref([])

  // Fetch tutorials for the current context.
  async function fetchTutorials(options = {}) {
    const { includeInactive = false } = options
    loading.value = true
    try {
      let query = supabase
        .from('training_tutorials')
        .select('*')
        .order('position')

      if (!includeInactive) {
        query = query.eq('status', 'active')
      }

      const { data, error } = await query
      if (!error) tutorials.value = data || []
    } finally {
      loading.value = false
    }
  }

  // Fetch a single tutorial with its steps
  async function fetchTutorial(slug) {
    loading.value = true
    try {
      const { data: tutorial, error } = await supabase
        .from('training_tutorials')
        .select('*')
        .eq('slug', slug)
        .eq('status', 'active')
        .maybeSingle()

      if (error || !tutorial) {
        currentTutorial.value = null
        return
      }

      const { data: steps } = await supabase
        .from('training_steps')
        .select('*')
        .eq('training_tutorial_id', tutorial.id)
        .order('position')

      currentTutorial.value = { ...tutorial, steps: steps || [] }

      // Fetch user's progress for this tutorial's steps
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user && steps?.length) {
        const stepIds = steps.map(s => s.id)
        const { data: prog } = await supabase
          .from('training_progress')
          .select('*')
          .eq('user_id', session.user.id)
          .in('training_step_id', stepIds)

        const progressMap = {}
        if (prog) {
          prog.forEach(p => {
            progressMap[p.training_step_id] = p
          })
        }
        progress.value = progressMap
      }
    } finally {
      loading.value = false
    }
  }

  // Fetch a single step
  async function fetchStep(tutorialSlug, stepSlug) {
    if (!currentTutorial.value || currentTutorial.value.slug !== tutorialSlug) {
      await fetchTutorial(tutorialSlug)
    }
    if (currentTutorial.value?.steps) {
      currentStep.value = currentTutorial.value.steps.find(s => s.slug === stepSlug) || null
    }
  }

  // Mark a step as completed
  async function markStepCompleted(stepId) {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return

    const { data, error } = await supabase
      .from('training_progress')
      .upsert({
        user_id: session.user.id,
        training_step_id: stepId,
        completed: true,
        completed_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,training_step_id'
      })
      .select()
      .maybeSingle()

    if (!error && data) {
      progress.value[stepId] = data
    }
  }

  // Mark a step as incomplete
  async function markStepIncomplete(stepId) {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return

    const { error } = await supabase
      .from('training_progress')
      .update({ completed: false, completed_at: null })
      .eq('user_id', session.user.id)
      .eq('training_step_id', stepId)

    if (!error) {
      if (progress.value[stepId]) {
        progress.value[stepId].completed = false
        progress.value[stepId].completed_at = null
      }
    }
  }

  // Get progress stats for a tutorial
  function tutorialProgress(tutorialId) {
    const tutorial = tutorials.value.find(t => t.id === tutorialId) || currentTutorial.value
    if (!tutorial?.steps) return { completed: 0, total: 0, percentage: 0 }

    const total = tutorial.steps.length
    const completed = tutorial.steps.filter(s => progress.value[s.id]?.completed).length
    return {
      completed,
      total,
      percentage: total > 0 ? Math.round((completed / total) * 100) : 0
    }
  }

  // Teacher: fetch tutorials assigned to a class
  async function fetchClassTutorials(classId) {
    const { data, error } = await supabase
      .from('class_training_tutorials')
      .select('*, training_tutorial:training_tutorials(*)')
      .eq('class_id', classId)

    if (!error) classTutorials.value = data || []
    return data || []
  }

  // Teacher: assign a tutorial to a class
  async function assignTutorialToClass(classId, tutorialId) {
    const { error } = await supabase
      .from('class_training_tutorials')
      .insert({ class_id: classId, training_tutorial_id: tutorialId })

    if (!error) await fetchClassTutorials(classId)
    return !error
  }

  // Teacher: remove a tutorial from a class
  async function removeTutorialFromClass(classId, tutorialId) {
    const { error } = await supabase
      .from('class_training_tutorials')
      .delete()
      .eq('class_id', classId)
      .eq('training_tutorial_id', tutorialId)

    if (!error) {
      classTutorials.value = classTutorials.value.filter(
        ct => ct.training_tutorial_id !== tutorial_id
      )
    }
    return !error
    }

    // Admin: Create or update a tutorial
    async function saveTutorial(tutorial, options = {}) {
    const { data, error } = await supabase
      .from('training_tutorials')
      .upsert({
        id: tutorial.id || undefined,
        title: tutorial.title,
        slug: tutorial.slug,
        description: tutorial.description,
        category: tutorial.category,
        status: tutorial.status,
        position: tutorial.position || 0,
        deck_pdf_url: tutorial.deck_pdf_url || null,
        source_type: tutorial.source_type || null,
        source_url: tutorial.source_url || null,
        source_name: tutorial.source_name || null
      })
      .select()
      .single()

    if (!error && data) {
      await fetchTutorials(options)
    }
    return { data, error }
    }

    // Admin: Delete a tutorial
    async function deleteTutorial(id) {
    const { error } = await supabase
      .from('training_tutorials')
      .delete()
      .eq('id', id)

    if (!error) {
      tutorials.value = tutorials.value.filter(t => t.id !== id)
    }
    return !error
    }

    // Admin: Save a step
    async function saveStep(step) {
    const { data, error } = await supabase
      .from('training_steps')
      .upsert({
        id: step.id || undefined,
        training_tutorial_id: step.training_tutorial_id,
        title: step.title,
        slug: step.slug,
        content: step.content,
        position: step.position || 0,
        duration_minutes: step.duration_minutes || 5
      })
      .select()
      .single()

    return { data, error }
    }

    // Admin: Delete a step
    async function deleteStep(id) {
    const { error } = await supabase
      .from('training_steps')
      .delete()
      .eq('id', id)

    return !error
    }

    return {
    tutorials,
    currentTutorial,
    currentStep,
    progress,
    loading,
    classTutorials,
    fetchTutorials,
    fetchTutorial,
    fetchStep,
    markStepCompleted,
    markStepIncomplete,
    tutorialProgress,
    fetchClassTutorials,
    assignTutorialToClass,
    removeTutorialFromClass,
    saveTutorial,
    deleteTutorial,
    saveStep,
    deleteStep
    }
    })
