(function () {
  const searchInput = document.getElementById('global-search')
  document.addEventListener('keydown', (e) => {
    const target = e.target
    const isTyping = ['INPUT', 'TEXTAREA'].includes(target.tagName)
    if (e.key === '/' && !isTyping) {
      e.preventDefault()
      searchInput?.focus()
    }
    if (e.key === 'n' && !isTyping) {
      window.location.href = '/notes#new'
    }
    if (e.key === 't' && !isTyping) {
      window.location.href = '/todos#new'
    }
  })

  const sidebar = document.getElementById('sidebar')
  const toggle = document.getElementById('sidebar-toggle')
  const backdrop = document.getElementById('sidebar-backdrop')
  const closeSidebar = () => {
    sidebar.classList.remove('open')
    sidebar.classList.add('hidden')
    backdrop?.classList.add('hidden')
    document.body.classList.remove('sidebar-open')
  }
  const openSidebar = () => {
    sidebar.classList.remove('hidden')
    sidebar.classList.add('open')
    backdrop?.classList.remove('hidden')
    document.body.classList.add('sidebar-open')
  }
  if (toggle && sidebar) {
    toggle.addEventListener('click', () => {
      const isOpen = sidebar.classList.contains('open')
      if (isOpen) closeSidebar()
      else openSidebar()
    })
  }
  backdrop?.addEventListener('click', closeSidebar)
  sidebar?.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      if (window.innerWidth < 640) closeSidebar()
    })
  })

  // Ricorrente toggle: mostra/nasconde pannello in /todos
  const recurringToggle = document.getElementById('recurring-toggle')
  const recurringFields = document.getElementById('recurring-fields')
  if (recurringToggle && recurringFields) {
    const sync = () => {
      if (recurringToggle.checked) {
        recurringFields.classList.remove('hidden')
      } else {
        recurringFields.classList.add('hidden')
      }
    }
    recurringToggle.addEventListener('change', sync)
    sync()
  }
})()
