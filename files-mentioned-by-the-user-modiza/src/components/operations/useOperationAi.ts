"use client";
import { useEffect,useState } from "react";
export function useOperationAi(){const[enabled,setEnabled]=useState(false);useEffect(()=>{fetch("/api/operations/status").then(response=>response.json()).then(result=>setEnabled(result.enabled===true)).catch(()=>setEnabled(false));},[]);return enabled;}
