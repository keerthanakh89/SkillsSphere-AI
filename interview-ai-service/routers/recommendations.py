from typing import List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services.learning_recommender import generate_learning_plan

router = APIRouter()

class RecommendLearningRequest(BaseModel):
    weak_concepts: List[str]
    topic: Optional[str] = "React"

class LearningPlanItem(BaseModel):
    concept: str
    explanation: str
    resources: List[str]

class RecommendLearningResponse(BaseModel):
    plan: List[LearningPlanItem]

@router.post("/recommend-learning", response_model=RecommendLearningResponse)
async def recommend_learning(request: RecommendLearningRequest):
    """
    Generate personalized learning plan based on weak concepts using RAG context.
    """
    if not request.weak_concepts:
        raise HTTPException(status_code=400, detail="weak_concepts list cannot be empty")
        
    result = generate_learning_plan(request.weak_concepts, request.topic)
    
    return RecommendLearningResponse(
        plan=[LearningPlanItem(**item) for item in result.get("plan", [])]
    )
