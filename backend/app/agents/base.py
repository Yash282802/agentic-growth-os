import logging
import asyncio
from typing import Callable, Dict, List, Any

logger = logging.getLogger("agentiq")

class AgentIQAgent:
    def __init__(self, name: str, description: str):
        self.name = name
        self.description = description

    async def run(self, input_data: Any, log_callback: Callable[[str], None]) -> Any:
        raise NotImplementedError("Each agent must implement run()")

class AgentIQWorkflow:
    """
    Simulates NVIDIA AgentIQ Multi-Agent Orchestrator DAG.
    Coordinates sequential execution, error handling, and reasoning log collection.
    """
    def __init__(self):
        self.agents: Dict[str, AgentIQAgent] = {}
        self.execution_order: List[str] = []
        self.logs: List[Dict[str, Any]] = []

    def register_agent(self, agent: AgentIQAgent):
        self.agents[agent.name] = agent
        logger.info(f"Registered Agent with AgentIQ: {agent.name}")

    def set_execution_order(self, order: List[str]):
        self.execution_order = order

    async def execute(self, initial_input: Any, sse_callback: Callable[[Dict[str, Any]], None]) -> Any:
        """
        Executes the agents sequentially, streaming status and logs via the callback.
        """
        current_data = initial_input
        
        for agent_name in self.execution_order:
            if agent_name not in self.agents:
                raise ValueError(f"Agent {agent_name} not registered in workflow.")
            
            agent = self.agents[agent_name]
            
            # Send 'running' status
            sse_callback({
                "type": "status",
                "agent": agent_name,
                "status": "running",
                "message": f"Agent {agent.name} is starting execution..."
            })
            
            # Helper function for streaming logs from within the agent
            def log_fn(message: str):
                log_entry = {
                    "type": "log",
                    "agent": agent_name,
                    "message": f"[{agent_name}] {message}"
                }
                sse_callback(log_entry)
                logger.info(f"[{agent_name}] {message}")

            try:
                # Run agent (which may call NIM or mock fallback)
                current_data = await agent.run(current_data, log_fn)
                
                # Send 'done' status
                sse_callback({
                    "type": "status",
                    "agent": agent_name,
                    "status": "done",
                    "message": f"Agent {agent.name} completed successfully."
                })
            except Exception as e:
                logger.exception(f"Error in agent {agent_name}")
                sse_callback({
                    "type": "status",
                    "agent": agent_name,
                    "status": "failed",
                    "message": f"Error: {str(e)}"
                })
                raise e
                
        return current_data
