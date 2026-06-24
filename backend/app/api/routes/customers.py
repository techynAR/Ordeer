"""
app/api/routes/customers.py
---------------------------
FastAPI router for the /customers resource.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.schemas.customer import (
    CustomerCreate,
    CustomerDetailResponse,
    CustomerResponse,
    CustomerSearchResult,
    CustomerUpdate,
)
from app.services import customer_service
from app.services.customer_service import CustomerHasOrdersError, CustomerNotFoundError

router = APIRouter(prefix="/customers", tags=["customers"])


# ---------------------------------------------------------------------------
# POST /customers
# ---------------------------------------------------------------------------
@router.post(
    "",
    response_model=CustomerResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a customer",
)
def create_customer(
    data: CustomerCreate,
    db: Session = Depends(get_db),
) -> CustomerResponse:
    return customer_service.create_customer(db, data)


# ---------------------------------------------------------------------------
# GET /customers/search
# ---------------------------------------------------------------------------
@router.get(
    "/search",
    response_model=list[CustomerSearchResult],
    summary="Search customers by name, email, or phone",
)
def search_customers(
    q: str = Query(..., min_length=1, description="Search query"),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
) -> list[CustomerSearchResult]:
    return customer_service.search_customers(db, q, limit=limit)


# ---------------------------------------------------------------------------
# GET /customers
# ---------------------------------------------------------------------------
@router.get(
    "",
    response_model=list[CustomerResponse],
    summary="List all customers",
)
def list_customers(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
) -> list[CustomerResponse]:
    return customer_service.get_all_customers(db, skip=skip, limit=limit)


# ---------------------------------------------------------------------------
# GET /customers/{id}
# ---------------------------------------------------------------------------
@router.get(
    "/{customer_id}",
    response_model=CustomerDetailResponse,
    summary="Get a customer by id (with order history and revenue aggregates)",
)
def get_customer(
    customer_id: int,
    db: Session = Depends(get_db),
) -> CustomerDetailResponse:
    try:
        return customer_service.get_customer(db, customer_id)
    except CustomerNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


# ---------------------------------------------------------------------------
# PATCH /customers/{id}
# ---------------------------------------------------------------------------
@router.patch(
    "/{customer_id}",
    response_model=CustomerResponse,
    summary="Update a customer",
)
def update_customer(
    customer_id: int,
    data: CustomerUpdate,
    db: Session = Depends(get_db),
) -> CustomerResponse:
    try:
        return customer_service.update_customer(db, customer_id, data)
    except CustomerNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


# ---------------------------------------------------------------------------
# DELETE /customers/{id}
# ---------------------------------------------------------------------------
@router.delete(
    "/{customer_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a customer",
)
def delete_customer(
    customer_id: int,
    db: Session = Depends(get_db),
) -> None:
    try:
        customer_service.delete_customer(db, customer_id)
    except CustomerNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except CustomerHasOrdersError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
