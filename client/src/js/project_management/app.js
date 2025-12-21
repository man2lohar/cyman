let db;
let projects = [], tasks = [];
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();

const projectModalEl = document.getElementById("projectModal");
const projectModal = new bootstrap.Modal(projectModalEl);
const taskModalEl = document.getElementById("taskModal");
const taskModal = new bootstrap.Modal(taskModalEl);

// === IndexedDB ===
const request = indexedDB.open("PMDB",1);
request.onupgradeneeded = e=>{
  db = e.target.result;
  if(!db.objectStoreNames.contains("projects")) db.createObjectStore("projects",{keyPath:"id",autoIncrement:true});
  if(!db.objectStoreNames.contains("tasks")) db.createObjectStore("tasks",{keyPath:"id",autoIncrement:true});
};
request.onsuccess = e=>{
  db = e.target.result;
  loadData();
};

// === Utility Functions ===
function saveItem(storeName,obj){
  return new Promise(resolve=>{
    const tx = db.transaction(storeName,"readwrite");
    const store = tx.objectStore(storeName);
    if(obj.id) store.put(obj); else store.add(obj);
    tx.oncomplete=()=>resolve();
  });
}

function deleteItem(storeName,id){
  return new Promise(resolve=>{
    const tx = db.transaction(storeName,"readwrite");
    const store = tx.objectStore(storeName);
    store.delete(id);
    tx.oncomplete=()=>resolve();
  });
}

function getAll(storeName){
  return new Promise(resolve=>{
    const tx = db.transaction(storeName,"readonly");
    const store = tx.objectStore(storeName);
    const req = store.getAll();
    req.onsuccess=e=>resolve(e.target.result);
  });
}

// === Load Data ===
async function loadData(){
  projects = await getAll("projects");
  tasks = await getAll("tasks");
  renderProjects();
  renderTaskOptions();
  renderCalendar();
}

// === Projects ===
function renderProjects(){
  const list = document.getElementById("projectList");
  list.innerHTML="";
  projects.forEach(p=>{
    const li = document.createElement("li");
    li.className="list-group-item d-flex justify-content-between align-items-center";
    li.innerHTML = `
  <strong title="${p}">${p}</strong>
  <div>
    <button class="btn btn-sm btn-outline-light me-1" onclick="editProject(${i})">✏️</button>
    <button class="btn btn-sm btn-outline-danger" onclick="deleteProject(${i})">🗑️</button>
  </div>`;

    list.appendChild(li);
  });
}

document.getElementById("saveProject").onclick=async()=>{
  const name = document.getElementById("projectName").value.trim();
  if(!name) return alert("Project name required");
  const id = parseInt(document.getElementById("editProjectIndex").value);
  await saveItem("projects", id ? {id,name} : {name});
  document.getElementById("projectName").value="";
  document.getElementById("editProjectIndex").value="";
  projectModal.hide();
  await loadData();
};

function editProject(id){
  const p = projects.find(x=>x.id===id);
  document.getElementById("editProjectIndex").value = p.id;
  document.getElementById("projectName").value = p.name;
  projectModal.show();
}

async function deleteProject(id){
  if(!confirm("Delete project?")) return;
  await deleteItem("projects",id);
  tasks.filter(t=>t.projectId===id).forEach(t=>deleteItem("tasks",t.id));
  await loadData();
}

// === Tasks ===
function renderTaskOptions(){
  const sel = document.getElementById("taskProject");
  sel.innerHTML="";
  projects.forEach(p=>{
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.name;
    sel.appendChild(opt);
  });
}

document.getElementById("saveTask").onclick=async()=>{
  const description = document.getElementById("taskDesc").value.trim();
  const target = document.getElementById("taskTarget").value;
  const priority = document.getElementById("taskPriority").value;
  const projectId = parseInt(document.getElementById("taskProject").value);
  const completed = document.getElementById("taskCompleted").checked;
  if(!description || !target) return alert("Description and Target Date required");
  const id = parseInt(document.getElementById("editTaskIndex").value);
  await saveItem("tasks", id ? {id,description,target,priority,projectId,completed} : {description,target,priority,projectId,completed});
  document.getElementById("taskDesc").value="";
  document.getElementById("taskTarget").value="";
  document.getElementById("taskPriority").value="low";
  document.getElementById("taskCompleted").checked=false;
  document.getElementById("editTaskIndex").value="";
  taskModal.hide();
  await loadData();
};

function editTask(id){
  const t = tasks.find(x=>x.id===id);
  document.getElementById("editTaskIndex").value = t.id;
  document.getElementById("taskProject").value = t.projectId;
  document.getElementById("taskDesc").value = t.description;
  document.getElementById("taskTarget").value = t.target;
  document.getElementById("taskPriority").value = t.priority;
  document.getElementById("taskCompleted").checked = t.completed;
  taskModal.show();
}

async function deleteTask(id){
  if(!confirm("Delete task?")) return;
  await deleteItem("tasks",id);
  await loadData();
}

// === Calendar ===
function renderCalendar(){
  const calendar = document.getElementById("calendar");
  calendar.innerHTML="";
  const firstDay = new Date(currentYear,currentMonth,1).getDay();
  const daysInMonth = new Date(currentYear,currentMonth+1,0).getDate();
  const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  document.getElementById("monthYear").textContent = `${monthNames[currentMonth]} ${currentYear}`;

  // Empty slots before first day
  for(let i=0;i<firstDay;i++){
    const div = document.createElement("div");
    calendar.appendChild(div);
  }

  for(let d=1;d<=daysInMonth;d++){
    const div = document.createElement("div");
    div.innerHTML = `<span class="date-num">${d}</span>`;
    const dateStr = `${currentYear}-${String(currentMonth+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    tasks.filter(t=>t.target===dateStr).forEach(t=>{
      const badge = document.createElement("span");
      badge.className = "badge-task bg-"+(t.priority==="low"?"success":t.priority==="medium"?"warning":"danger");
      badge.textContent = t.description;
      badge.title = `${t.description} [${t.completed?"✅":""}]`;
      badge.onclick = ()=>editTask(t.id);
      div.appendChild(badge);
    });
    if(dateStr===new Date().toISOString().split("T")[0]) div.style.border="2px solid blue";
    calendar.appendChild(div);
  }
}

// Prev/Next Month
document.getElementById("prevMonth").onclick=()=>{
  currentMonth--;
  if(currentMonth<0){currentMonth=11; currentYear--;}
  renderCalendar();
};
document.getElementById("nextMonth").onclick=()=>{
  currentMonth++;
  if(currentMonth>11){currentMonth=0; currentYear++;}
  renderCalendar();
};


// === Assessment Page ===
const assessmentPage = document.getElementById("assessmentPage");
const calendarSection = document.querySelector(".flex-grow-1");

document.getElementById("assessmentBtn").onclick = () => {
  calendarSection.style.display = "none";
  assessmentPage.style.display = "block";
  renderAssessment();
};

document.getElementById("backCalendar").onclick = () => {
  calendarSection.style.display = "block";
  assessmentPage.style.display = "none";
};

// Filters
document.getElementById("filterProject").onchange = renderAssessment;
document.getElementById("filterStatus").onchange = renderAssessment;
document.getElementById("filterPriority").onchange = renderAssessment;

// Export CSV
document.getElementById("exportCSV").onclick = () => {
  let filtered = getFilteredTasks();
  let csv = "Project,Task,Target Date,Status,Priority\n";
  filtered.forEach(t=>{
    const p = projects.find(pr=>pr.id===t.projectId)?.name || "";
    const status = t.completed?"Completed":new Date(t.target)<new Date()?"Failed":"Pending";
    csv += `${p},${t.description},${t.target},${status},${t.priority}\n`;
  });
  const blob = new Blob([csv],{type:"text/csv"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download="tasks.csv"; a.click();
  URL.revokeObjectURL(url);
};

function getFilteredTasks(){
  let filtered = [...tasks];
  const fp = document.getElementById("filterProject").value;
  const fs = document.getElementById("filterStatus").value;
  const fpr = document.getElementById("filterPriority").value;
  if(fp!=="all") filtered = filtered.filter(t=>t.projectId==fp);
  if(fpr!=="all") filtered = filtered.filter(t=>t.priority===fpr);
  if(fs!=="all"){
    filtered = filtered.filter(t=>{
      const status = t.completed?"completed":(new Date(t.target)<new Date()?"failed":"pending");
      return status===fs;
    });
  }
  return filtered;
}

function renderAssessment(){
  // Populate project filter
  const projectFilter = document.getElementById("filterProject");
  projectFilter.innerHTML = '<option value="all">All Projects</option>';
  projects.forEach(p=>projectFilter.innerHTML += `<option value="${p.id}">${p.name}</option>`);

  const filtered = getFilteredTasks();

  // Table
  const tbody = document.querySelector("#assessmentTable tbody");
  tbody.innerHTML="";
  filtered.forEach(t=>{
    const p = projects.find(pr=>pr.id===t.projectId)?.name || "";
    const status = t.completed?"Completed":new Date(t.target)<new Date()?"Failed":"Pending";
    tbody.innerHTML += `<tr>
      <td>${p}</td>
      <td>${t.description}</td>
      <td>${t.target}</td>
      <td>${status}</td>
      <td>${t.priority}</td>
    </tr>`;
  });

  // Charts
  const completed = filtered.filter(t=>t.completed).length;
  const pending = filtered.filter(t=>!t.completed && new Date(t.target)>=new Date()).length;
  const failed = filtered.filter(t=>!t.completed && new Date(t.target)<new Date()).length;

  // Pie Chart
  const pieCtx = document.getElementById("pieChart").getContext("2d");
  if(window.pieChartInstance) window.pieChartInstance.destroy();
  window.pieChartInstance = new Chart(pieCtx,{
    type:"pie",
    data:{
      labels:["Completed","Pending","Failed"],
      datasets:[{data:[completed,pending,failed], backgroundColor:["#198754","#ffc107","#dc3545"]}]
    }
  });

  // Bar Chart - tasks per project
  const barCtx = document.getElementById("barChart").getContext("2d");
  const taskCountPerProject = projects.map(p=>{
    const count = filtered.filter(t=>t.projectId===p.id).length;
    return {project:p.name,count};
  });
  if(window.barChartInstance) window.barChartInstance.destroy();
  window.barChartInstance = new Chart(barCtx,{
    type:"bar",
    data:{
      labels: taskCountPerProject.map(x=>x.project),
      datasets:[{
        label:"Tasks",
        data: taskCountPerProject.map(x=>x.count),
        backgroundColor:"#0d6efd"
      }]
    },
    options:{scales:{y:{beginAtZero:true}}}
  });
}
