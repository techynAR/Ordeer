"""
app/api/routes/customers.py
---------------------------
FastAPI router for the /customers resource.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.schemas.customer import CustomerCreate, CustomerResponse
from app.services import customer_service
from app.services.customer_service import CustomerNotFoundError, CustomerHasOrdersError

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
    response_model=CustomerResponse,
    summary="Get a customer by id",
)
def get_customer(
    customer_id: int,
    db: Session = Depends(get_db),
) -> CustomerResponse:
    try:
        return customer_service.get_customer(db, customer_id)
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
