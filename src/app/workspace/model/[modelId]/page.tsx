import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth";
import { getWorkspaceModel } from "@/server/workspace-media-service";
import { MediaError } from "@/server/workspace-media-contract";
import { WorkspaceModelViewer, type ModelLabels } from "@/components/tracelab/workspace-model-viewer";
import "./viewer.css";
export const dynamic="force-dynamic";
const words:Record<string,ModelLabels & {back:string;private:string}>= {
  ru:{loading:"Загружаем модель",error:"Не удалось показать модель. Исходный файл сохранён; его можно скачать.",retry:"Повторить",cancel:"Отменить",reset:"Сбросить вид",wireframe:"Каркас",solid:"Поверхность",fullscreen:"На весь экран",hint:"Потяни для вращения · Два пальца для масштаба · Правая кнопка для перемещения",download:"Скачать GLB",zoomIn:"Приблизить",zoomOut:"Отдалить",viewer:"3D-модель",back:"Вернуться к моделям",private:"Приватная версия модели. Доступ проверяется при каждом запросе файла."},
  en:{loading:"Loading model",error:"The model could not be displayed. The source file is preserved and available to download.",retry:"Try again",cancel:"Cancel",reset:"Reset view",wireframe:"Wireframe",solid:"Solid",fullscreen:"Fullscreen",hint:"Drag to rotate · Pinch to zoom · Right-drag to pan",download:"Download GLB",zoomIn:"Zoom in",zoomOut:"Zoom out",viewer:"3D model",back:"Back to models",private:"Private model version. Access is checked on every file request."},
  kk:{loading:"Модель жүктелуде",error:"Модель көрсетілмеді. Бастапқы файл сақталған, оны жүктеп алуға болады.",retry:"Қайталау",cancel:"Бас тарту",reset:"Көріністі қалпына келтіру",wireframe:"Қаңқа",solid:"Беткі қабат",fullscreen:"Толық экран",hint:"Бұру үшін сүйре · Масштаб үшін екі саусақты қолдан · Жылжыту үшін оң батырмамен сүйре",download:"GLB жүктеп алу",zoomIn:"Жақындату",zoomOut:"Алыстату",viewer:"3D-модель",back:"Модельдерге оралу",private:"Модельдің жабық нұсқасы. Файлға әр сұрауда қолжетімділік тексеріледі."},
};
export default async function ModelPage({params}:{params:Promise<{modelId:string}>}){
  const {modelId}=await params,user=await getCurrentUser();
  if(!user)redirect("/auth?next="+encodeURIComponent("/workspace/model/"+modelId));
  let model;
  try{model=await getWorkspaceModel(user,modelId);}catch(error){if(error instanceof MediaError && [403,404].includes(error.status))notFound();throw error;}
  const language=(await cookies()).get("pt_lang")?.value || user.locale;
  const labels=words[language] ?? words.en;
  return <main id="main" className="wm-model-page" lang={language in words?language:"en"}>
    <a href={"/workspace/?"+new URLSearchParams({view:"models",team:model.teamId,project:model.projectId})} className="wm-model-back">← {labels.back}</a>
    <header><span>TraceLab · {model.model?.versionLabel}</span><h1>{model.name}</h1><p>{model.caption}</p></header>
    <WorkspaceModelViewer src={model.url} title={model.name} labels={labels}/>
    <p className="wm-model-private">{labels.private}</p>
  </main>;
}
