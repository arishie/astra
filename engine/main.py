from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any
from agent_graph import app as graph_app
from langchain_core.messages import HumanMessage
import uvicorn
import os
import agentops

# Initialize AgentOps if API key is present
if os.getenv("AGENTOPS_API_KEY"):
    agentops.init(os.getenv("AGENTOPS_API_KEY"))

app = FastAPI(title="Astra Neural Engine", version="1.0.0")

class RequestModel(BaseModel):
    query: str
    context: Dict[str, Any] = {}

class ResponseModel(BaseModel):
    response: str
    steps: List[str] = []

@app.get("/")
def health_check():
    return {"status": "active", "system": "Astra Engine"}

@app.post("/process", response_model=ResponseModel)
async def process_request(req: RequestModel):
    """
    Main entry point for the Orchestrator to send complex tasks.
    """
    try:
        print(f"[Engine] Received query: {req.query}")
        
        inputs = {"messages": [HumanMessage(content=req.query)], "next_step": "generalist"}
        
        # Run the LangGraph workflow
        final_state = graph_app.invoke(inputs)
        
        # Extract final response
        messages = final_state['messages']
        last_msg = messages[-1]
        
        return {
            "response": last_msg.content,
            "steps": [str(m.content) for m in messages] # simplified log
        }
        
    except Exception as e:
        print(f"[Engine] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
