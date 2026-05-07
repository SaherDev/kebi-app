// ==========================================
// KEBI_APP LOCAL TESTING SNIPPETS
// Copy & paste into browser console
// No real API calls - localStorage only
// ==========================================

function resetApp() {
  console.log('🔄 Resetting app...')
  localStorage.clear()
  location.reload()
}

function testColdStartZero() {
  console.log('🧊 Testing Cold-Start Zero (0 saved places)')
  localStorage.clear()
  location.reload()
}

function testColdStart1to4() {
  console.log('❄️ Testing Cold-Start 1-4 (3 saved places)')
  const places = [
    {place_id:'1',place_name:'Fuji Ramen',address:'123 Sukhumvit'},
    {place_id:'2',place_name:'Steak House',address:'456 Sukhumvit'},
    {place_id:'3',place_name:'Coffee Shop',address:'789 Sukhumvit'}
  ]
  localStorage.setItem('kebi-app.savedPlaces',JSON.stringify(places))
  localStorage.setItem('kebi-app.savedCount','3')
  location.reload()
}

function testColdStart5Plus() {
  console.log('🌟 Testing Cold-Start 5+ (6 saved places)')
  const places = [
    {place_id:'1',place_name:'Fuji',address:'123 St'},
    {place_id:'2',place_name:'Steak',address:'456 St'},
    {place_id:'3',place_name:'Coffee',address:'789 St'},
    {place_id:'4',place_name:'Sushi',address:'111 St'},
    {place_id:'5',place_name:'Pizza',address:'222 St'},
    {place_id:'6',place_name:'Burger',address:'333 St'}
  ]
  localStorage.setItem('kebi-app.savedPlaces',JSON.stringify(places))
  localStorage.setItem('kebi-app.savedCount','6')
  location.reload()
}

function confirmTasteProfile() {
  console.log('✅ Confirming taste profile...')
  localStorage.setItem('kebi-app.tasteProfileConfirmed','true')
  useHomeStore.getState().confirmTasteProfile()
  location.reload()
}

function viewPhase() {
  const phase = useHomeStore.getState().phase
  const count = useHomeStore.getState().savedPlaceCount
  console.log(`📍 Current Phase: ${phase} | Saved Places: ${count}`)
}

function viewThreadEntries() {
  const thread = useHomeStore.getState().thread
  console.table(thread.map((e,i) => ({
    index: i,
    role: e.role,
    type: e.type || '-',
    message: e.message || e.content || '-'
  })))
}

function viewStorage() {
  console.log('📦 LocalStorage:')
  console.table({
    savedCount: localStorage.getItem('kebi-app.savedCount'),
    tasteProfileConfirmed: localStorage.getItem('kebi-app.tasteProfileConfirmed'),
    savedPlaces: JSON.parse(localStorage.getItem('kebi-app.savedPlaces') || '[]').length + ' places'
  })
}

// ==========================================
// QUICK REFERENCE
// ==========================================
console.log(`
╔═══════════════════════════════════════════════════════════╗
║       KEBI_APP TESTING SNIPPETS - QUICK REFERENCE           ║
╠═══════════════════════════════════════════════════════════╣
║                                                           ║
║ COLD-START TESTS:                                         ║
║   testColdStartZero()     → 0 places (ColdStartZero)      ║
║   testColdStart1to4()     → 3 places (ColdStartOneFour)   ║
║   testColdStart5Plus()    → 6 places (TasteProfile)       ║
║   confirmTasteProfile()   → Transition to idle            ║
║                                                           ║
║ VIEW STATE:                                               ║
║   viewPhase()             → Current phase & count         ║
║   viewThreadEntries()     → All thread messages           ║
║   viewStorage()           → localStorage contents         ║
║                                                           ║
║ UTILITIES:                                                ║
║   resetApp()              → Clear everything & reload     ║
║                                                           ║
║ REAL API TESTS:                                           ║
║   Use Chat Input on page (no functions needed)            ║
║   - "ramen link" → Save flow                              ║
║   - "that place" → Recall flow                            ║
║   - "good ramen" → Consult flow                           ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`)
